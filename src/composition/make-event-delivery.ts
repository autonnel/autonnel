import { createHash } from "crypto";
import type { DomainEventEnvelope } from "../modules/shared-kernel/event-envelope";
import { runWithTenant } from "../lib/tenant/context";
import { getBasePrisma } from "../lib/db";
import { getTenantPrisma } from "../modules/platform/infra/prisma-tenant-extension";
import { createLogger } from "../lib/logger";
import { IdempotencyKey } from "../modules/shared-kernel/idempotency-key";
import type { CheckoutSnapshot } from "../modules/storefront-checkout/application/checkout-snapshot";
import { isDeferredContactNormalized } from "../modules/storefront-checkout/domain/value-objects/deferred-contact";
import type { AddressSnapshot } from "../modules/order-fulfillment/domain/value-objects";
import { handlePaymentCaptured } from "../modules/acquisition-ads/infra/jobs/payment-captured.subscriber";
import { makeOrderFulfillment, type OrderFulfillmentContext } from "./make-order-fulfillment";
import { makeCommerceGatewayReadSide } from "./make-commerce-gateway";
import { ExternalRef } from "../modules/commerce-gateway/domain/value-objects/external-ref";
import { Market } from "../modules/commerce-gateway/domain/value-objects/market";
import { MQEventType } from "../lib/adapters/mq/types";
import { makeCoupons } from "./make-coupons";
import { buildOrderFulfillmentDeps } from "./order-fulfillment-deps";
import { makeAcquisitionAds } from "./make-acquisition-ads";
import { createAdsDepsForRequest } from "./make-ads-deps";
import { storefrontCheckoutDepsFromLocals } from "./storefront-runtime";
import { deliverEventNotifications } from "./deliver-event-notifications";
import { deliverEnvelope, type EventHandler } from "./event-delivery-core";
import { makeRecall } from "./make-recall";
import { createRecallDepsForRequest } from "./make-recall-deps";
import { dispatchRecallEvent } from "../modules/recall/infra/subscribers/recall-event-subscriber";
import { OutboxEventPublisher } from "../modules/platform/infra/outbox-event-publisher";
import { TenantEventPublisher } from "../modules/platform/infra/tenant-event-publisher";

const logger = createLogger("EventDelivery");

interface PaymentCapturedPayload {
  providerChargeId: string;
  capturedAmountMinor: number;
  currencyCode: string;
  payer?: { email?: string; name?: string; address?: { line1?: string; line2?: string; city?: string; region?: string; countryCode?: string; postalCode?: string } };
}

interface RefundIssuedPayload {
  refundTransactionId: string;
  refundedAmountMinor: number;
  currencyCode: string;
}

interface SaleHandedOffPayload {
  saleRef: string;
  backendRef: string;
  snapshot?: CheckoutSnapshot;
}

interface CapturedPayment {
  status: string;
  capturedAmountMinor: number | null;
  currencyCode: string;
  checkoutSnapshot: CheckoutSnapshot | null;
}

async function loadCapturedPayment(saleRef: string, locals?: unknown): Promise<CapturedPayment | null> {
  const deps = storefrontCheckoutDepsFromLocals(locals);
  return deps.paymentSnapshots.loadBySaleRef(saleRef);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

// PayPal Express defers the buyer to a sentinel at submit; the real payer arrives with the capture.
// Backfill the PI snapshot so BOTH the Order and the commerce handoff carry the real buyer.
function backfillDeferredBuyer(snapshot: CheckoutSnapshot, payer: PaymentCapturedPayload["payer"], fallbackCountry: string): CheckoutSnapshot | null {
  if (!payer?.email || !isDeferredContactNormalized(snapshot.buyer.normalized)) return null;
  const email = payer.email.trim().toLowerCase();
  const a = payer.address;
  const address = a?.line1
    ? { line1: a.line1, line2: a.line2, city: a.city ?? "", region: a.region, countryCode: a.countryCode ?? fallbackCountry, postalCode: a.postalCode ?? "" }
    : snapshot.buyer.address;
  return {
    ...snapshot,
    buyer: {
      fullName: payer.name ?? snapshot.buyer.fullName,
      address: address as unknown as Record<string, unknown>,
      channel: "email",
      normalized: email,
      hashedIdentity: sha256Hex(email),
    },
  };
}

// First-touch URL (with click ids) = the earliest tracked activity event for this visitor.
async function loadFirstSeenUrl(tenantId: string, visitorId: string): Promise<string | undefined> {
  const row = await getBasePrisma().userActivityEvent.findFirst({
    where: { tenantId, visitorId, url: { not: null } },
    orderBy: { occurredAt: "asc" },
    select: { url: true },
  });
  return row?.url ?? undefined;
}

function snapshotToOrderLines(snapshot: CheckoutSnapshot) {
  return snapshot.lines.map((l) => ({
    externalRef: l.variantExternalId,
    title: l.title,
    quantity: l.quantity,
    unitPriceMinor: l.unitPriceMinor,
    lineTotalMinor: l.unitPriceMinor * l.quantity,
  }));
}

function snapshotToCustomer(snapshot: CheckoutSnapshot): { email: string; name?: string; phone?: string } {
  const buyer = snapshot.buyer;
  return {
    email: buyer.channel === "email" ? buyer.normalized : "",
    name: buyer.fullName || undefined,
    phone: buyer.channel === "phone" ? buyer.normalized : undefined,
  };
}

function snapshotToContact(snapshot: CheckoutSnapshot) {
  const buyer = snapshot.buyer;
  return {
    channel: buyer.channel,
    normalized: buyer.normalized,
    hashedIdentity: buyer.hashedIdentity,
    address: buyer.address as unknown as AddressSnapshot,
  };
}

// PaymentIntent is already CAPTURED by the payments side before this fires. Capture drives the
// commerce handoff (the order is created separately by deliverOrderCreation). When PayPal Express
// deferred the buyer, the real payer arrives here — persist it onto the PI snapshot first so the
// handoff (which sources the buyer from the snapshot) pushes the real customer.
async function deliverPaymentCaptured(envelope: DomainEventEnvelope, locals?: unknown): Promise<void> {
  const saleRef = envelope.correlation?.saleRef;
  if (!saleRef) {
    logger.warn("payment.captured envelope missing correlation.saleRef; skipping", { eventId: envelope.eventId });
    return;
  }
  const deps = storefrontCheckoutDepsFromLocals(locals);
  const payload = envelope.payload as PaymentCapturedPayload;
  const payment = await deps.paymentSnapshots.loadBySaleRef(saleRef);
  if (payment?.checkoutSnapshot) {
    const backfilled = backfillDeferredBuyer(payment.checkoutSnapshot, payload.payer, deps.market?.countryCode ?? "US");
    if (backfilled) await deps.paymentSnapshots.updateCheckoutSnapshot(saleRef, backfilled);
  }
  // Stripe merged upsells hold the single ecommerce push until the upsell chain ends (the upsell
  // endpoint / safety-net cron enqueues it then), so it carries base + all accepted upsells.
  const intentRow = await getBasePrisma().paymentIntent.findUnique({
    where: { tenantId_saleRef: { tenantId: envelope.tenantId, saleRef } },
    select: { handoffDeferred: true },
  });
  if (intentRow?.handoffDeferred) {
    logger.info("commerce handoff deferred for merged upsell push", { saleRef });
    return;
  }
  await deps.jobQueue.enqueue(
    "commerce.handoff",
    IdempotencyKey.derive(deps.tenantId, saleRef),
    { saleRef },
  );
}

// Order creation is driven by payment capture, NOT by the commerce-backend handoff. The Order is an
// autonnel domain entity; whether the downstream push to Shopify/Picocart succeeds is irrelevant to
// its existence and status. The handoff later enriches it with a backend ref (deliverSaleHandedOff).
// Lines/buyer come from the PaymentIntent snapshot (already deferred-buyer-backfilled above).
async function deliverOrderCreation(envelope: DomainEventEnvelope, locals?: unknown): Promise<void> {
  const saleRef = envelope.correlation?.saleRef;
  if (!saleRef) {
    logger.warn("payment.captured order creation missing correlation.saleRef; skipping", { eventId: envelope.eventId });
    return;
  }
  const payload = envelope.payload as PaymentCapturedPayload;
  const payment = await loadCapturedPayment(saleRef, locals);
  if (!payment?.checkoutSnapshot) {
    logger.warn("payment.captured order creation for unknown PaymentIntent; skipping", { saleRef });
    return;
  }
  const snapshot = payment.checkoutSnapshot;
  // The order records the first-visited URL (with clickids) for post-payment attribution/postback.
  // The session is server-minted (disjoint from the order's saleRef), so join on the tracking
  // visitorId — the only stable key shared by the analytics session and the checkout snapshot.
  const firstSeenUrl = snapshot.visitorId ? await loadFirstSeenUrl(envelope.tenantId, snapshot.visitorId) : undefined;
  const attribution: { sessionId?: string; visitorId?: string; funnelId?: string; firstSeenUrl?: string } = { sessionId: snapshot.sessionId };
  if (snapshot.visitorId) attribution.visitorId = snapshot.visitorId;
  if (snapshot.funnelId) attribution.funnelId = snapshot.funnelId;
  if (firstSeenUrl) attribution.firstSeenUrl = firstSeenUrl;
  const ctx = makeOrderFulfillment(buildOrderFulfillmentDeps(locals as never));
  const created = await ctx.createOrderFromPaidSale.handle({
    saleRef,
    capturedTotalMinor: payload.capturedAmountMinor,
    currencyCode: payload.currencyCode,
    captureIdempotencyKey: IdempotencyKey.derive(envelope.tenantId, saleRef).value,
    lines: snapshotToOrderLines(snapshot),
    customer: snapshotToCustomer(snapshot),
    contact: snapshotToContact(snapshot),
    checkoutLanguage: snapshot.locale ?? null,
    attribution,
  });

  // Advance coupon usageCount exactly once per order. Gated on `created` so event redelivery
  // (which finds the existing Order) never double-counts.
  if (created && snapshot.couponCode) {
    await makeCoupons().redeem(snapshot.couponCode);
  }

  // Verify the charged prices against the live catalog exactly once. Gated on `created` so
  // redelivery never re-flags or re-notifies. Never blocks: the payment is already captured.
  if (created) {
    await verifyPaidPricesAgainstLive(saleRef, snapshot, payload, ctx);
  }
}

export interface PriceMismatch {
  ref: string;
  title: string;
  paidMinor: number;
  liveMinor: number;
}

// Pure: a line is mismatched only when its live price resolves AND differs from what was charged.
// Unresolvable lines (removed upstream / beyond the catalog cap) are skipped, never flagged.
export function detectPriceMismatches(
  lines: Array<{ variantExternalId: string; title: string; unitPriceMinor: number }>,
  livePriceByRef: Map<string, number | undefined>,
): PriceMismatch[] {
  const mismatches: PriceMismatch[] = [];
  for (const line of lines) {
    const liveMinor = livePriceByRef.get(line.variantExternalId);
    if (liveMinor === undefined) continue;
    if (liveMinor !== line.unitPriceMinor) {
      mismatches.push({ ref: line.variantExternalId, title: line.title, paidMinor: line.unitPriceMinor, liveMinor });
    }
  }
  return mismatches;
}

function formatPriceMismatchNote(mismatches: PriceMismatch[], currency: string): string {
  const major = (minor: number) => (minor / 100).toFixed(2);
  const detail = mismatches
    .map((m) => `${m.title || m.ref}: charged ${major(m.paidMinor)} vs live ${major(m.liveMinor)} ${currency}`)
    .join("; ");
  return `[PRICE MISMATCH] Live catalog price differs from the amount charged — ${detail}`;
}

// Post-payment safety net: re-resolve each line's price from the live commerce backend (shared 60s
// cache) and compare to what the customer was charged. On drift, flag the order and emit a
// notification — but never block fulfillment, since the money is already captured.
async function verifyPaidPricesAgainstLive(
  saleRef: string,
  snapshot: CheckoutSnapshot,
  payload: PaymentCapturedPayload,
  ctx: OrderFulfillmentContext,
): Promise<void> {
  const country = (
    payload.payer?.address?.countryCode ||
    (snapshot.buyer.address as { countryCode?: string }).countryCode ||
    "US"
  ).toUpperCase();
  const currency = payload.currencyCode;

  let gateway;
  try {
    gateway = await makeCommerceGatewayReadSide(country);
  } catch {
    return; // no active backend to verify against
  }

  let views;
  try {
    views = await gateway.resolvePurchasables({
      variantRefs: snapshot.lines.map((l) => ExternalRef.of(l.variantExternalId)),
      market: Market.of(country, currency),
    });
  } catch (error) {
    logger.warn("post-payment price verification skipped: live lookup failed", { saleRef, error });
    return;
  }

  const livePriceByRef = new Map(views.map((v) => [v.variantRef.toString(), v.price?.amountMinor]));
  const mismatches = detectPriceMismatches(snapshot.lines, livePriceByRef);
  if (mismatches.length === 0) return;

  logger.warn("post-payment price mismatch detected", { saleRef, currency, mismatches });

  const orderRow = await getTenantPrisma().order.findFirst({ where: { saleRef }, select: { id: true, note: true } });
  if (orderRow) {
    const flag = formatPriceMismatchNote(mismatches, currency);
    await ctx.setOrderNote.execute(orderRow.id, orderRow.note ? `${orderRow.note}\n${flag}` : flag);
  }

  try {
    await new TenantEventPublisher(new OutboxEventPublisher(getBasePrisma())).publish({
      type: MQEventType.ORDER_PRICE_MISMATCH,
      payload: { saleRef, currency, mismatches },
    });
  } catch (error) {
    logger.warn("failed to publish order.price_mismatch notification", { saleRef, error });
  }
}

async function deliverConversion(envelope: DomainEventEnvelope, locals?: unknown): Promise<void> {
  const saleRef = envelope.correlation?.saleRef;
  if (!saleRef) {
    logger.warn("payment.captured conversion missing correlation.saleRef; skipping", { eventId: envelope.eventId });
    return;
  }
  const payment = await loadCapturedPayment(saleRef, locals);
  if (!payment || !payment.checkoutSnapshot) {
    logger.warn("payment.captured conversion for unknown PaymentIntent; skipping", { saleRef });
    return;
  }
  const snapshot = payment.checkoutSnapshot;

  // funnelId is captured onto the snapshot at checkout, so conversion postbacks attribute
  // without any analytics-session lookup.
  const funnelId = snapshot.funnelId ?? "";

  const buyer = snapshot.buyer;
  const contactHandle =
    buyer.channel === "email"
      ? { emailSha256: sha256Hex(buyer.normalized) }
      : { phoneSha256: sha256Hex(buyer.normalized) };

  const ads = await makeAcquisitionAds(await createAdsDepsForRequest(locals as never));
  await handlePaymentCaptured(
    {
      saleRef,
      sessionId: snapshot.sessionId,
      funnelId,
      capturedTotal: {
        amountMinor: payment.capturedAmountMinor ?? 0,
        currencyCode: payment.currencyCode,
      },
      capturedAtMs: new Date(envelope.occurredAt).getTime(),
      contactHandle,
      consentLevel: "UNKNOWN",
    },
    ads.recordConversion,
  );
}

// Successful handoff only ENRICHES the already-created Order with its commerce-backend ref (used
// later by the fulfillment cron to poll tracking). It never creates the Order — that happened on
// payment capture — so a failed/late handoff never blocks the order or the customer's confirmation.
async function deliverSaleHandedOff(envelope: DomainEventEnvelope, locals?: unknown): Promise<void> {
  const payload = envelope.payload as SaleHandedOffPayload;
  const saleRef = payload.saleRef ?? envelope.correlation?.saleRef;
  if (!saleRef) {
    logger.warn("SaleHandedOff envelope missing saleRef; skipping", { eventId: envelope.eventId });
    return;
  }
  const ctx = makeOrderFulfillment(buildOrderFulfillmentDeps(locals as never));
  await ctx.attachBackendRef.handle(saleRef, payload.backendRef);
}

async function deliverRefundIssued(envelope: DomainEventEnvelope, locals?: unknown): Promise<void> {
  const saleRef = envelope.correlation?.saleRef;
  if (!saleRef) {
    logger.warn("payment.refund_issued envelope missing correlation.saleRef; skipping", { eventId: envelope.eventId });
    return;
  }
  const payload = envelope.payload as RefundIssuedPayload;
  const ctx = makeOrderFulfillment(buildOrderFulfillmentDeps(locals as never));
  await ctx.handleRefundIssued.handle({
    saleRef,
    refundTransactionId: payload.refundTransactionId,
    refundedAmountMinor: payload.refundedAmountMinor,
    currencyCode: payload.currencyCode,
  });
}

// Recall reacts to capture only to STOP an in-flight campaign (suppress + attribute recovery). Both
// recall handlers are non-critical feed paths: they swallow their own errors so a recall failure
// never blocks the money-critical capture handlers (order creation / conversion). Enrollment itself
// is order-driven (see /api/order/[orderId]/send-recall), not event-driven.
async function deliverRecallPaymentCaptured(envelope: DomainEventEnvelope, locals?: unknown): Promise<void> {
  const saleRef = envelope.correlation?.saleRef;
  if (!saleRef) return;
  try {
    const payment = await loadCapturedPayment(saleRef, locals);
    const checkoutRef = payment?.checkoutSnapshot?.sessionId;
    if (!checkoutRef) return;
    const recall = makeRecall(await createRecallDepsForRequest(locals as never));
    await dispatchRecallEvent(recall, {
      type: "PaymentCaptured",
      payload: { saleRef, checkoutRef, capturedAt: new Date(envelope.occurredAt).toISOString() },
    });
  } catch (error) {
    logger.error("recall payment-captured dispatch failed (non-blocking)", { saleRef, error });
  }
}

// Messaging publishes RecipientSuppressed as { channel, normalizedAddress, reason } with no
// hashedIdentity, but recall keys its contact suppression by hashedIdentity = sha256(normalized) —
// the same digest the checkout/order computes — so deriving it here makes a hard bounce / complaint
// stop every future recall touch to that address. Non-blocking feed path.
async function deliverRecallRecipientSuppressed(envelope: DomainEventEnvelope, locals?: unknown): Promise<void> {
  const p = envelope.payload as { channel?: string; normalizedAddress?: string; reason?: string };
  if (!p.normalizedAddress) return;
  try {
    const recall = makeRecall(await createRecallDepsForRequest(locals as never));
    await dispatchRecallEvent(recall, {
      type: "RecipientSuppressed",
      payload: {
        channel: p.channel ?? "email",
        normalizedAddress: p.normalizedAddress,
        hashedIdentity: sha256Hex(p.normalizedAddress),
        messagingReason: p.reason ?? "manual",
      },
    });
  } catch (error) {
    logger.error("recall recipient-suppressed dispatch failed (non-blocking)", { error });
  }
}

const ROUTES: Record<string, EventHandler[]> = {
  "payment.captured": [deliverPaymentCaptured, deliverOrderCreation, deliverConversion, deliverRecallPaymentCaptured],
  "payment.refund_issued": [deliverRefundIssued],
  SaleHandedOff: [deliverSaleHandedOff],
  "messaging.RecipientSuppressed": [deliverRecallRecipientSuppressed],
};

// At-least-once: a failing routed consumer leaves the outbox row unpublished so the drain retries it
// (idempotent consumers re-run safely), instead of swallowing the loss. See deliverEnvelope.
export function makeEventDelivery(locals?: unknown) {
  return async (envelope: DomainEventEnvelope): Promise<void> => {
    await runWithTenant(envelope.tenantId, async () => {
      await deliverEnvelope(envelope, ROUTES[envelope.type] ?? [], deliverEventNotifications, locals);
    });
  };
}
