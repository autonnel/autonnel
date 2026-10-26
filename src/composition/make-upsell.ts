import { getBasePrisma } from '@/lib/db';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { createLogger } from '@/lib/logger';
import { Money } from '@/modules/shared-kernel/money';
import { ExternalRef } from '@/modules/commerce-gateway/domain/value-objects/external-ref';
import { Market } from '@/modules/commerce-gateway/domain/value-objects/market';
import { makeCommerceGatewayReadSide } from '@/composition/make-commerce-gateway';
import { PrismaPaymentIntentRepository } from '@/modules/payments/infra/prisma/payment-intent.repository';
import { makeConfirmPayPalOrder, resolvePaymentProvider } from '@/composition/make-payments';
import { buildPaymentRequestContext, safeLocalPath, type CheckoutRequestInfo } from './payment-request-context';
import {
  finalizeHostedUpsellWith, hostedSessionRef, pendingUpsellsOf, reconcilePendingHostedUpsellsWith, snapshotWithEntryPatch, snapshotWithPending, hasPendingEntry,
  HOSTED_UPSELL_WINDOW_MS, type HostedUpsellOutcome, type PendingHostedUpsell,
} from './hosted-upsell';
import type { PaymentProviderPort, ProviderCaptureResult } from '@/modules/payments/application/ports/outbound';
import { PrismaOrderRepository } from '@/modules/order-fulfillment/infra/prisma/order.repository';
import { OfferLineSnapshot } from '@/modules/order-fulfillment/domain/value-objects';
import { getFunnelContext } from '@/lib/storefront/storefront-data.service';
import { funnelNextStepIsUpsell } from '@/lib/funnel-next-step';
import { runCheckoutDrain } from '@/composition/run-checkout-drain';
import { storefrontCheckoutDepsFromLocals } from '@/composition/storefront-runtime';
import { IdempotencyKey } from '@/modules/shared-kernel/idempotency-key';
import { runDeferredHandoffSweep } from '@/modules/payments/application/handoff-deferred-cron';
import { submitIndependentUpsell } from './handoff-coordinator';
import { dispatchPluginConversion, hasConversionSubscribers, loadVisitedUrls } from './plugin-runtime';
import type { ShopUpsellInput, ShopUpsellDto } from '@/contracts/shop';

interface SnapshotLine { variantExternalId: string; title: string; quantity: number; unitPriceMinor: number; currencyCode: string; capturedAt: string; upsellIndex?: number; }
interface SnapshotBuyer { fullName: string; hashedIdentity: string; address: Record<string, unknown>; channel: 'email' | 'phone'; normalized: string; }
interface Snapshot { lines: SnapshotLine[]; buyer?: SnapshotBuyer; [k: string]: unknown; }

const logger = createLogger('Upsell');

interface IntentRow {
  id: string;
  provider: string;
  status: string;
  currencyCode: string;
  providerIntentId: string | null;
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
  vaultRef: string | null;
  captureDeferred: boolean;
  handoffDeferred: boolean;
  checkoutSnapshot: unknown;
  pendingUpsellSince?: Date | null;
}

const AMBIGUOUS_CHARGE_CODES = new Set(['pending_timeout', 'unknown_outcome']);
const AMBIGUOUS_CHARGE_MESSAGE = 'Your payment is still being confirmed. Please do not pay again; we will update your order shortly.';
const VAULT_WAIT_MS = 5000;
const VAULT_POLL_MS = 1000;

// The reusable credential of hosted-page providers arrives with the provider notification, which
// can land a moment after the buyer reaches the upsell page.
async function waitForVault(saleRef: string, intent: IntentRow): Promise<IntentRow> {
  let current = intent;
  for (let waited = 0; !offSessionMethod(current) && waited < VAULT_WAIT_MS; waited += VAULT_POLL_MS) {
    await new Promise((resolve) => setTimeout(resolve, VAULT_POLL_MS));
    current = (await loadIntent(saleRef)) ?? current;
  }
  return current;
}

function offSessionMethod(intent: IntentRow): string | null {
  return intent.stripePaymentMethodId ?? intent.vaultRef ?? null;
}

function upsellKey(saleRef: string, upsellIndex: number): string {
  return `upsell:${saleRef}:${upsellIndex}`;
}

// The next storefront step's bare slug (workflow-ordered, cache-backed), carrying the order +
// tracking ids so the thank-you page can render. Mirrors the post-payment redirect shape.
async function resolveNextStepUrl(
  pageId: string | undefined,
  funnelId: string | undefined,
  params: { orderId: string; trackingId?: string },
): Promise<string | undefined> {
  if (!pageId) return undefined;
  const ctx = await getFunnelContext(pageId, funnelId ?? null);
  const base = ctx.stepUrl;
  if (!base) return undefined;
  const usp = new URLSearchParams();
  usp.set('orderId', params.orderId);
  if (params.trackingId) usp.set('trackingId', params.trackingId);
  if (funnelId) usp.set('funnelId', funnelId);
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${usp.toString()}`;
}

async function loadIntent(saleRef: string): Promise<IntentRow | null> {
  const row = await getBasePrisma().paymentIntent.findUnique({
    where: { tenantId_saleRef: { tenantId: getCurrentTenantId(), saleRef } },
    select: {
      id: true, provider: true, status: true, currencyCode: true, providerIntentId: true,
      stripeCustomerId: true, stripePaymentMethodId: true, vaultRef: true, captureDeferred: true, handoffDeferred: true, checkoutSnapshot: true, pendingUpsellSince: true,
    },
  });
  return (row as IntentRow | null) ?? null;
}

// "Last upsell" = the workflow step after this page is NOT another upsell, so PayPal must capture now.
async function isLastUpsell(pageId: string | undefined, funnelId: string | undefined): Promise<boolean> {
  if (!pageId) return true;
  return !(await funnelNextStepIsUpsell(pageId, funnelId ?? null).catch(() => false));
}

function appendedSnapshotLines(snapshot: Snapshot, line: ResolvedLine, upsellIndex: number): SnapshotLine[] {
  return [
    ...snapshot.lines,
    { variantExternalId: line.externalRef, title: line.title, quantity: line.quantity, unitPriceMinor: line.unitMinor, currencyCode: line.currency, capturedAt: new Date().toISOString(), upsellIndex },
  ];
}

// Stripe captures the upsell as a SEPARATE charge but the ecommerce push is ONE merged order: keep
// the intent's snapshot (handoff lines) + capturedMinor (handoff total) in sync with the appended line.
async function recordStripeUpsellForMergedPush(saleRef: string, loaded: Snapshot, line: ResolvedLine, upsellIndex: number): Promise<void> {
  const snapshot = ((await loadIntent(saleRef))?.checkoutSnapshot as Snapshot | null | undefined) ?? loaded;
  await new PrismaPaymentIntentRepository(getTenantPrisma()).updateCheckoutSnapshotBySaleRef(saleRef, { ...snapshot, lines: appendedSnapshotLines(snapshot, line, upsellIndex) });
  await getBasePrisma().paymentIntent.update({
    where: { tenantId_saleRef: { tenantId: getCurrentTenantId(), saleRef } },
    data: { capturedMinor: { increment: line.lineMinor } },
  });
}

// Fire the single merged ecommerce push (held since checkout) and clear the deferral so neither the
// cron nor a retry double-pushes. Drains so the handoff job runs promptly.
async function triggerMergedHandoff(saleRef: string, locals: unknown): Promise<void> {
  const deps = storefrontCheckoutDepsFromLocals(locals);
  await deps.jobQueue.enqueue('commerce.handoff', IdempotencyKey.derive(deps.tenantId, saleRef), { saleRef });
  await getBasePrisma().paymentIntent.update({
    where: { tenantId_saleRef: { tenantId: getCurrentTenantId(), saleRef } },
    data: { handoffDeferred: false },
  });
  await runCheckoutDrain(getCurrentTenantId(), saleRef, locals);
}

async function loadOrderSummary(saleRef: string): Promise<{ id: string; orderNumber: string; total: number; currency: string; items: unknown } | undefined> {
  const order = await new PrismaOrderRepository(getTenantPrisma() as never).findBySaleRef(saleRef);
  if (!order) return undefined;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    total: order.capturedTotal.amountMinor,
    currency: order.capturedTotal.currencyCode,
    items: order.lines.map((l) => ({ externalRef: l.externalRef, title: l.title, quantity: l.quantity, unitPriceMinor: l.unitPrice.amountMinor })),
  };
}

async function orderCountryCode(saleRef: string): Promise<string> {
  const order = await getBasePrisma().order.findUnique({
    where: { tenantId_saleRef: { tenantId: getCurrentTenantId(), saleRef } },
    select: { address: true },
  });
  const addr = (order?.address ?? null) as { countryCode?: string; country?: string } | null;
  return addr?.countryCode || addr?.country || 'US';
}

async function appendLineToOrder(
  saleRef: string,
  line: { externalRef: string; title: string; quantity: number; unitMinor: number; lineMinor: number; currency: string },
  locals: unknown,
): Promise<{ id: string; orderNumber: string; total: number; currency: string; items: unknown } | undefined> {
  const repo = new PrismaOrderRepository(getTenantPrisma() as never);
  let order = await repo.findBySaleRef(saleRef);
  if (!order) {
    // The base order materializes asynchronously; nudge the drain so the upsell line has a home.
    await runCheckoutDrain(getCurrentTenantId(), saleRef, locals);
    order = await repo.findBySaleRef(saleRef);
  }
  if (!order) return undefined;
  order.addUpsellLine(
    OfferLineSnapshot.of({
      externalRef: line.externalRef,
      title: line.title,
      quantity: line.quantity,
      unitPrice: Money.of(line.unitMinor, line.currency),
      lineTotal: Money.of(line.lineMinor, line.currency),
    }),
  );
  await repo.save(order);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    total: order.capturedTotal.amountMinor,
    currency: order.capturedTotal.currencyCode,
    items: order.lines.map((l) => ({ externalRef: l.externalRef, title: l.title, quantity: l.quantity, unitPriceMinor: l.unitPrice.amountMinor })),
  };
}

interface ResolvedLine { externalRef: string; title: string; quantity: number; unitMinor: number; lineMinor: number; currency: string; }

export async function declineUpsell(input: ShopUpsellInput, locals?: unknown): Promise<ShopUpsellDto> {
  const nextStepUrl = await resolveNextStepUrl(input.pageId, input.funnelId, {
    orderId: input.parentOrderId,
    trackingId: input.trackingId,
  });
  // Declining the LAST upsell must still finalize the held order:
  //  - PayPal: capture the deferred order (base + upsells accepted earlier), else the sale is lost.
  //  - Stripe: fire the held single ecommerce push (base already captured at checkout).
  try {
    const intent = await loadIntent(input.parentOrderId);
    if (intent && (await isLastUpsell(input.pageId, input.funnelId))) {
      if (intent.provider === 'PAYPAL' && intent.captureDeferred && intent.status === 'AUTHORIZED') {
        const cap = await makeConfirmPayPalOrder().captureNow({ saleRef: input.parentOrderId });
        if (cap.status === 'succeeded') await runCheckoutDrain(getCurrentTenantId(), input.parentOrderId, locals);
      } else if (intent.handoffDeferred && intent.status === 'CAPTURED') {
        await triggerMergedHandoff(input.parentOrderId, locals);
      }
    }
  } catch (err) {
    logger.error('Finalizing held order on decline failed', { error: err, saleRef: input.parentOrderId });
  }
  logger.info('Upsell declined', { saleRef: input.parentOrderId, upsellIndex: input.upsellIndex });
  return { success: true, action: 'declined', nextStepUrl };
}

export async function acceptUpsell(input: ShopUpsellInput, locals: unknown, request?: CheckoutRequestInfo): Promise<ShopUpsellDto> {
  const saleRef = input.parentOrderId;
  const upsellIndex = input.upsellIndex ?? 0;
  const quantity = Math.max(1, input.quantity ?? 1);
  const externalRef = input.variantId || input.productId;
  const nextStepUrl = await resolveNextStepUrl(input.pageId, input.funnelId, { orderId: saleRef, trackingId: input.trackingId });

  if (!externalRef) return { success: false, error: 'No product selected', nextStepUrl };

  const intent = await loadIntent(saleRef);
  if (!intent) return { success: false, error: 'Order not found', nextStepUrl };

  // Server-authoritative price from the catalog — never trust the client-sent amount.
  const currency = intent.currencyCode;
  const country = await orderCountryCode(saleRef);
  const gateway = await makeCommerceGatewayReadSide(country);
  const [view] = await gateway.resolvePurchasables({ variantRefs: [ExternalRef.of(externalRef)], market: Market.of(country, currency) });
  if (!view || !view.price) return { success: false, error: 'Product is not available', nextStepUrl };

  const unitMinor = view.price.amountMinor;
  const line: ResolvedLine = { externalRef, title: view.title || 'Upsell', quantity, unitMinor, lineMinor: unitMinor * quantity, currency };
  const addedItem = { externalRef, title: line.title, quantity, unitPriceMinor: unitMinor };

  const provider = await resolvePaymentProvider(intent.provider);
  if (provider.patchOrderAmount) return acceptPaypalUpsell({ intent, input, saleRef, upsellIndex, line, addedItem, nextStepUrl, locals, provider });
  if (provider.chargeOffSession) return acceptOffSessionUpsell({ intent, input, saleRef, upsellIndex, line, addedItem, nextStepUrl, locals, provider, request });
  return { success: false, error: 'Upsell not available for this payment method', nextStepUrl };
}

// Off-session: each accepted upsell is a separate charge on the saved payment method; the base order
// already exists, so append the line to it.
async function acceptOffSessionUpsell(p: {
  intent: IntentRow; input: ShopUpsellInput; saleRef: string; upsellIndex: number; line: ResolvedLine;
  addedItem: Record<string, unknown>; nextStepUrl?: string; locals: unknown;
  provider: PaymentProviderPort; request?: CheckoutRequestInfo;
}): Promise<ShopUpsellDto> {
  const { intent, input, saleRef, upsellIndex, line, addedItem, nextStepUrl, locals, provider, request } = p;
  const ready = intent.status === 'CAPTURED' && intent.provider !== 'STRIPE' ? await waitForVault(saleRef, intent) : intent;
  const paymentMethodId = offSessionMethod(ready);
  if (ready.status === 'CAPTURED' && !paymentMethodId && ready.provider !== 'STRIPE' && request) {
    const hosted = await startHostedUpsell({ intent: ready, input, saleRef, upsellIndex, line, addedItem, nextStepUrl, locals, provider, request });
    if (hosted) return hosted;
  }
  if (ready.status !== 'CAPTURED' || !paymentMethodId) {
    return { success: false, error: 'Saved payment method unavailable', nextStepUrl };
  }
  const tenantId = getCurrentTenantId();
  const idempotencyKey = upsellKey(saleRef, upsellIndex);
  const last = await isLastUpsell(input?.pageId, input?.funnelId);

  const prior = await getBasePrisma().transaction.findUnique({
    where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    select: { id: true },
  });
  if (prior) {
    // Idempotent re-POST: already charged + merged. Do NOT re-append; just ensure the held push fires
    // on the last step (covers a retry after a prior handoff-enqueue failure), then return the order.
    if (last && intent.handoffDeferred) await triggerMergedHandoff(saleRef, locals).catch(() => {});
    return { success: true, action: 'accepted', order: await loadOrderSummary(saleRef), addedItem, nextStepUrl };
  }

  const snapshot = (ready.checkoutSnapshot ?? null) as Snapshot | null;
  const result = await provider.chargeOffSession!({
    customerId: ready.stripeCustomerId ?? undefined,
    paymentMethodId,
    amountMinor: line.lineMinor,
    currencyCode: line.currency,
    idempotencyKey,
    saleRef,
    context: {
      ...buildPaymentRequestContext({ slug: ready.provider, saleRef, snapshot: snapshot as never }),
      lines: [{ sku: line.externalRef, title: line.title, quantity: line.quantity, unitPriceMinor: line.unitMinor, currencyCode: line.currency }],
      clientIp: request?.clientIp,
      userAgent: request?.userAgent,
      notifyUrl: request ? new URL(`/api/shop/payment/webhook/${ready.provider.toLowerCase()}`, request.origin).toString() : undefined,
    },
  });
  if (result.status !== 'CAPTURED' || !result.capture) {
    const code = result.error?.code;
    if (code && AMBIGUOUS_CHARGE_CODES.has(code)) {
      logger.error('Upsell charge outcome is ambiguous; manual reconciliation required', { saleRef, upsellIndex, code });
      return { success: false, error: AMBIGUOUS_CHARGE_MESSAGE, nextStepUrl };
    }
    const error = result.status === 'REQUIRES_ACTION' ? 'Your bank requires authentication for this charge' : 'Card was declined';
    logger.warn('Upsell charge not captured', { saleRef, upsellIndex, status: result.status });
    return { success: false, error, nextStepUrl };
  }

  const order = await recordUpsellCharge({ saleRef, intent: ready, upsellIndex, line, capture: result.capture, pageId: input?.pageId, funnelId: input?.funnelId, locals });
  logger.info('Upsell accepted (off-session)', { saleRef, upsellIndex, provider: ready.provider, amountMinor: line.lineMinor });
  return { success: true, action: 'accepted', order, addedItem, nextStepUrl };
}

async function recordedCharge(saleRef: string, upsellIndex: number): Promise<{ chargeRef: string | null } | null> {
  const row = await getBasePrisma().transaction.findUnique({
    where: { tenantId_idempotencyKey: { tenantId: getCurrentTenantId(), idempotencyKey: upsellKey(saleRef, upsellIndex) } },
    select: { id: true, chargeRef: true },
  });
  return row ? { chargeRef: (row as { chargeRef?: string | null }).chargeRef ?? null } : null;
}

// Re-reads the snapshot right before writing so changes made while a provider call was in flight
// survive, and keeps the sweep marker in step with whether any entry is still pending.
async function mutatePendingSnapshot(saleRef: string, change: (snapshot: unknown) => unknown, refreshMarker = false): Promise<void> {
  const fresh = await loadIntent(saleRef);
  if (!fresh) return;
  const next = change(fresh.checkoutSnapshot);
  await new PrismaPaymentIntentRepository(getTenantPrisma()).updateCheckoutSnapshotBySaleRef(saleRef, next);
  const wantsMarker = hasPendingEntry(next);
  const hasMarker = fresh.pendingUpsellSince != null;
  if (wantsMarker === hasMarker && !(refreshMarker && wantsMarker)) return;
  await getBasePrisma().paymentIntent.update({
    where: { tenantId_saleRef: { tenantId: getCurrentTenantId(), saleRef } },
    data: { pendingUpsellSince: wantsMarker ? new Date() : null },
  });
}

// No reusable credential (hosted-page providers): the upsell is paid on a second hosted page and
// confirmed later by a status query, see finalizeHostedUpsell.
async function startHostedUpsell(p: {
  intent: IntentRow; input: ShopUpsellInput; saleRef: string; upsellIndex: number; line: ResolvedLine;
  addedItem: Record<string, unknown>; nextStepUrl?: string; locals: unknown; provider: PaymentProviderPort; request: CheckoutRequestInfo;
}): Promise<ShopUpsellDto | null> {
  const { intent, input, saleRef, upsellIndex, line, addedItem, nextStepUrl, locals, provider, request } = p;
  const previous = pendingUpsellsOf(intent.checkoutSnapshot)[String(upsellIndex)];
  // A buyer who paid on an earlier page and clicked again must not be charged twice.
  const settled = previous
    ? (await finalizeHostedUpsell(saleRef, upsellIndex, locals).catch((error) => {
        logger.error('Finalizing the earlier hosted upsell failed; opening a new attempt', { error, saleRef, upsellIndex });
        return 'pending' as const;
      })) === 'captured'
    : !!(await recordedCharge(saleRef, upsellIndex));
  if (settled) return { success: true, action: 'accepted', order: await loadOrderSummary(saleRef), addedItem, nextStepUrl };

  const attempt = (previous?.sessionRefs.length ?? 0) + 1;
  const sessionRef = hostedSessionRef(saleRef, upsellIndex, attempt);
  const slug = intent.provider.toLowerCase();
  const returnUrl = new URL(`/api/shop/payment/upsell-return/${slug}`, request.origin);
  returnUrl.searchParams.set('saleRef', saleRef);
  returnUrl.searchParams.set('n', String(upsellIndex));
  const created = await provider.createIntent({
    amountMinor: line.lineMinor,
    currencyCode: line.currency,
    captureMethod: 'automatic',
    idempotencyKey: sessionRef,
    saleRef: sessionRef,
    context: {
      ...buildPaymentRequestContext({ slug: intent.provider, saleRef: sessionRef, snapshot: (intent.checkoutSnapshot ?? undefined) as never }),
      lines: [{ sku: line.externalRef, title: line.title, quantity: line.quantity, unitPriceMinor: line.unitMinor, currencyCode: line.currency }],
      returnUrl: returnUrl.toString(),
      notifyUrl: new URL(`/api/shop/payment/webhook/${slug}`, request.origin).toString(),
      clientIp: request.clientIp,
      userAgent: request.userAgent,
    },
  });
  if (created.clientHandle.kind !== 'redirect_url') return null;

  const entry: PendingHostedUpsell = {
    upsellIndex, sessionRef, sessionRefs: [sessionRef], status: 'pending', attempt, line, nextStepUrl,
    cancelTo: safeLocalPath(input.cancelTo, '') || undefined,
    pageId: input.pageId, funnelId: input.funnelId,
    createdAt: new Date().toISOString(),
  };
  await mutatePendingSnapshot(saleRef, (snapshot) => snapshotWithPending(snapshot, entry), true);
  logger.info('Upsell redirected to hosted page', { saleRef, upsellIndex, attempt, provider: intent.provider });
  return { success: true, action: 'redirect', redirectUrl: created.clientHandle.value };
}

export async function finalizeHostedUpsell(saleRef: string, upsellIndex: number, locals: unknown): Promise<HostedUpsellOutcome> {
  return finalizeHostedUpsellWith<IntentRow>({
    loadIntent,
    recordedCharge,
    queryStatus: async (intent, sessionRef, hint) => (await resolvePaymentProvider(intent.provider)).getIntent(sessionRef, hint),
    recordCharge: async (intent, entry, capture) => {
      await recordUpsellCharge({ saleRef, intent, upsellIndex, line: entry.line, capture, pageId: entry.pageId, funnelId: entry.funnelId, locals, stopIfRecorded: true });
    },
    updateEntry: (ref, n, patch) => mutatePendingSnapshot(ref, (snapshot) => snapshotWithEntryPatch(snapshot, n, patch)),
    onPaidTwice: (ref, n, sessionRef, providerChargeId) =>
      logger.error('hosted upsell paid twice; refund required', { saleRef: ref, upsellIndex: n, sessionRef, providerChargeId }),
    onQueryError: (error, ref, sessionRef) => logger.warn('Hosted upsell status query failed', { error, saleRef: ref, sessionRef }),
  }, saleRef, upsellIndex);
}

export async function loadPendingHostedUpsell(saleRef: string, upsellIndex: number): Promise<PendingHostedUpsell | undefined> {
  return pendingUpsellsOf((await loadIntent(saleRef))?.checkoutSnapshot)[String(upsellIndex)];
}

// Sweep for buyers who never came back from the hosted page. `pendingUpsellSince` marks intents
// holding at least one pending entry, so the scan needs no JSON filtering and cannot be crowded out
// by unrelated rows. The tenant client scopes it to the current tenant.
export async function reconcilePendingHostedUpsells(limit = 50): Promise<{ scanned: number; captured: number; errors: number }> {
  return reconcilePendingHostedUpsellsWith({
    candidates: async () => {
      const rows = await getTenantPrisma().paymentIntent.findMany({
        where: { pendingUpsellSince: { not: null, gt: new Date(Date.now() - HOSTED_UPSELL_WINDOW_MS) } },
        select: { saleRef: true, checkoutSnapshot: true },
        orderBy: { pendingUpsellSince: 'asc' },
        take: limit,
      });
      return rows as Array<{ saleRef: string; checkoutSnapshot: unknown }>;
    },
    finalize: (saleRef, upsellIndex) => finalizeHostedUpsell(saleRef, upsellIndex, undefined),
    onError: (error, saleRef, upsellIndex) => logger.error('Hosted upsell reconcile failed', { error, saleRef, upsellIndex }),
  }, limit);
}

// Post-charge steps shared by the off-session and hosted-page paths: record the CHARGE, notify
// conversion subscribers, append the order line and hand the line to the ecommerce push.
async function recordUpsellCharge(p: {
  saleRef: string; intent: IntentRow; upsellIndex: number; line: ResolvedLine; capture: ProviderCaptureResult;
  pageId?: string; funnelId?: string; locals: unknown; stopIfRecorded?: boolean;
}): Promise<{ id: string; orderNumber: string; total: number; currency: string; items: unknown } | undefined> {
  const { saleRef, intent, upsellIndex, line, capture, locals } = p;
  const idempotencyKey = upsellKey(saleRef, upsellIndex);
  const snapshot = (intent.checkoutSnapshot ?? null) as Snapshot | null;
  const last = await isLastUpsell(p.pageId, p.funnelId);
  let recorded = true;
  try {
    await getTenantPrisma().transaction.create({
      data: {
        type: 'CHARGE', status: 'SUCCEEDED', amountMinor: line.lineMinor, currencyCode: line.currency,
        provider: intent.provider, providerRefundRef: capture.providerChargeId, parentTransactionId: intent.id,
        chargeRef: capture.providerChargeId, idempotencyKey,
      } as never,
    });
  } catch (err) {
    if ((err as { code?: string })?.code !== 'P2002') throw err;
    recorded = false;
    if (p.stopIfRecorded) return undefined;
  }
  if (recorded) {
    await dispatchUpsellConversion(saleRef, intent, line, upsellIndex, locals).catch((err) =>
      logger.error('Plugin upsell conversion dispatch failed', { error: err, saleRef, upsellIndex }));
  }

  const order = await appendLineToOrder(saleRef, line, locals).catch((err) => {
    logger.error('Upsell charged but appending to order failed', { error: err, saleRef, upsellIndex });
    return undefined;
  });
  // Keep the held merged push (snapshot lines + total) in sync, then fire it once on the last step.
  if (intent.handoffDeferred) {
    if (snapshot && Array.isArray(snapshot.lines)) {
      await recordStripeUpsellForMergedPush(saleRef, snapshot, line, upsellIndex).catch((err) =>
        logger.error('Failed to record Stripe upsell for merged push', { error: err, saleRef, upsellIndex }));
    }
    if (last) await triggerMergedHandoff(saleRef, locals).catch((err) =>
      logger.error('Merged handoff trigger failed (cron will retry)', { error: err, saleRef }));
  } else {
    // The main order was already pushed to the backend (handoff not deferred), so this late upsell
    // cannot be folded into it — push it as an independent external order tagged to the parent.
    // Covers merged late-degrade and split late-accept; prevents the upsell from being lost.
    await pushUpsellIndependently(saleRef, intent, line, upsellIndex).catch((err) =>
      logger.error('Independent upsell push failed (cron will retry)', { error: err, saleRef, upsellIndex }));
  }
  return order;
}

async function dispatchUpsellConversion(saleRef: string, intent: IntentRow, line: ResolvedLine, upsellIndex: number, locals: unknown): Promise<void> {
  if (!hasConversionSubscribers()) return;
  const snapshot = (intent.checkoutSnapshot ?? null) as (Snapshot & { visitorId?: string | null; funnelId?: string | null }) | null;
  await dispatchPluginConversion(
    {
      kind: 'upsell',
      conversionId: `${saleRef}-upsell-${upsellIndex}`,
      saleRef,
      amountMinor: line.lineMinor,
      currencyCode: line.currency,
      funnelId: snapshot?.funnelId ?? undefined,
      visitedUrls: await loadVisitedUrls(getCurrentTenantId(), snapshot?.visitorId ?? undefined),
      occurredAt: new Date().toISOString(),
    },
    locals as never,
  );
}

async function pushUpsellIndependently(saleRef: string, intent: IntentRow, line: ResolvedLine, upsellIndex: number): Promise<void> {
  const summary = await loadOrderSummary(saleRef);
  if (!summary) {
    logger.warn('Independent upsell push skipped: parent order not found', { saleRef, upsellIndex });
    return;
  }
  const buyer = ((intent.checkoutSnapshot ?? null) as Snapshot | null)?.buyer ?? null;
  const customer: Record<string, unknown> = buyer
    ? { fullName: buyer.fullName, hashedIdentity: buyer.hashedIdentity, shippingAddress: buyer.address, email: buyer.channel === 'email' ? buyer.normalized : undefined }
    : {};
  await submitIndependentUpsell({
    saleRef,
    upsellIndex,
    parentOrderNumber: summary.orderNumber,
    line: { variantExternalId: line.externalRef, quantity: line.quantity, unitPriceMinor: line.unitMinor, currencyCode: line.currency },
    customer,
  });
}

// PayPal: the order is approved-but-not-captured. PATCH it to add the upsell amount + record the
// line in the snapshot (no charge). When the buyer leaves the upsell chain, capture once — the order
// then materializes with base + all accepted upsells.
async function acceptPaypalUpsell(p: {
  intent: IntentRow; input: ShopUpsellInput; saleRef: string; upsellIndex: number; line: ResolvedLine;
  addedItem: Record<string, unknown>; nextStepUrl?: string; locals: unknown; provider: PaymentProviderPort;
}): Promise<ShopUpsellDto> {
  const { intent, input, saleRef, upsellIndex, line, addedItem, nextStepUrl, locals, provider } = p;
  if (!intent.captureDeferred || intent.status !== 'AUTHORIZED' || !intent.providerIntentId) {
    return { success: false, error: 'Upsell not available for this order', nextStepUrl };
  }
  const snapshot = (intent.checkoutSnapshot ?? null) as Snapshot | null;
  if (!snapshot || !Array.isArray(snapshot.lines)) return { success: false, error: 'Order data unavailable', nextStepUrl };

  // Idempotency: a re-POST for the same upsellIndex must not patch the amount twice.
  if (!snapshot.lines.some((l) => l.upsellIndex === upsellIndex)) {
    const updatedLines: SnapshotLine[] = [
      ...snapshot.lines,
      { variantExternalId: line.externalRef, title: line.title, quantity: line.quantity, unitPriceMinor: line.unitMinor, currencyCode: line.currency, capturedAt: new Date().toISOString(), upsellIndex },
    ];
    const newTotalMinor = updatedLines.reduce((s, l) => s + l.unitPriceMinor * l.quantity, 0);
    if (!provider.patchOrderAmount) return { success: false, error: 'Upsell not supported', nextStepUrl };
    await provider.patchOrderAmount(intent.providerIntentId, line.currency, newTotalMinor);
    await new PrismaPaymentIntentRepository(getTenantPrisma()).updateCheckoutSnapshotBySaleRef(saleRef, { ...snapshot, lines: updatedLines });
  }

  if (await isLastUpsell(input.pageId, input.funnelId)) {
    const cap = await makeConfirmPayPalOrder().captureNow({ saleRef });
    if (cap.status === 'succeeded') {
      await runCheckoutDrain(getCurrentTenantId(), saleRef, locals);
      const order = await loadOrderSummary(saleRef);
      logger.info('Upsell accepted (PayPal, final capture)', { saleRef, upsellIndex });
      return { success: true, action: 'accepted', order, addedItem, nextStepUrl };
    }
    // Patch is persisted; the safety-net cron will capture later. Still advance the buyer.
    logger.error('PayPal final capture failed after upsell patch', { saleRef, upsellIndex, status: cap.status });
  }
  logger.info('Upsell accepted (PayPal, patched)', { saleRef, upsellIndex });
  return { success: true, action: 'accepted', addedItem, nextStepUrl };
}

// Cron entry: push abandoned Stripe merged-upsell orders as ONE merged ecommerce order (the held
// push from checkout). Runs in the scheduled worker; the enqueued handoff job is drained the same tick.
export async function runStripeMergedHandoffSweep(cutoffMs = 20 * 60_000, limit = 50): Promise<{ pushed: number; failed: number; scanned: number }> {
  const deps = storefrontCheckoutDepsFromLocals(undefined);
  return runDeferredHandoffSweep({
    intentRepo: new PrismaPaymentIntentRepository(getTenantPrisma()),
    enqueueHandoff: async (saleRef) => { await deps.jobQueue.enqueue('commerce.handoff', IdempotencyKey.derive(deps.tenantId, saleRef), { saleRef }); },
    clearFlag: async (saleRef) => {
      await getBasePrisma().paymentIntent.update({ where: { tenantId_saleRef: { tenantId: getCurrentTenantId(), saleRef } }, data: { handoffDeferred: false } });
    },
    cutoff: new Date(Date.now() - cutoffMs),
    limit,
  });
}
