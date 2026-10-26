import type { PrismaClient } from '@prisma/client';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { getMemoryCache } from '@/lib/adapters/cache/memory';
import { getBasePrisma } from '@/lib/db';
import { OutboxEventPublisher } from '@/modules/platform/infra/outbox-event-publisher';
import { TenantEventPublisher } from '@/modules/platform/infra/tenant-event-publisher';
import { getBinding, getRuntimeEnv } from '@/lib/runtime/env';
import { resolveSessionSecret } from '@/lib/services/session-secret';
import { createLogger } from '@/lib/logger';
import { SaleRef } from '@/modules/payments/domain/value-objects';
import { Market } from '@/modules/commerce-gateway/domain/value-objects/market';
import { ExternalRef } from '@/modules/commerce-gateway/domain/value-objects/external-ref';
import { PrismaCouponRepository } from '@/modules/coupons/infra/prisma/coupon.repository';
import { PrismaPublicationReader } from '@/modules/storefront-checkout/infra/prisma/prisma-publication-reader';
import { publishFunnelForStep } from './funnel-publishing';
import { buildPaymentRequestContext, snapshotWithReturnTargets, type CheckoutRequestInfo } from './payment-request-context';
import type { CatalogReadPort as GatewayCatalogReadPort, SubmitHandoffCommand } from '@/modules/commerce-gateway/application/ports/inbound';
import type { SubmitHandoffService } from '@/modules/commerce-gateway/application/submit-handoff.service';
import type { PurchasableDto } from '@/modules/storefront-checkout/infra/clients/commerce-catalog-client';
import type { HandoffPayload } from '@/modules/storefront-checkout/domain/services/handoff-payload-assembler';
import type { CouponDefinition } from '@/modules/storefront-checkout/domain/services/coupon-evaluation-service';
import { assertRedeemableInCartCurrency, couponRatesFor, previewCoupon, toCouponDefinition, type CouponPreview, type CouponRedemptionDeps } from './coupon-redemption';
import { makeCoupons } from './make-coupons';
import { makePaymentsCommand, makePaymentsQuery } from './make-payments';
import type { CheckoutSnapshot } from '@/modules/storefront-checkout/application/checkout-snapshot';
import { makeCommerceGatewayReadSide, makeSubmitHandoffService, readCurrencyRates } from './make-commerce-gateway';
import { PrismaOrderRepository } from '@/modules/order-fulfillment/infra/prisma/order.repository';
import { getFulfillmentMode } from '@/lib/config/ecommerce';
import { executeHandoffForSale, submitIndependentUpsell } from './handoff-coordinator';
import type { HandoffForSaleDeps, SplitContext } from './handoff-coordinator';
import { makePlatform, registerJobHandler } from './make-platform';
import { makeStorefrontConsumers } from './make-storefront-consumers';
import { checkoutMarket, isSellablePurchasable, marketForCurrency } from './checkout-market';
import { makeStorefrontCheckout, type StorefrontCheckoutDeps } from './make-storefront-checkout';

const logger = createLogger('StorefrontRuntime');

interface KvBindingLike {
  get(key: string, type: 'text'): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface KvLike {
  get(k: string): Promise<string | null>;
  put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void>;
  delete(k: string): Promise<void>;
}

interface CfLocals {
  cfContext?: { waitUntil(p: Promise<unknown>): void };
}

function kvFromBinding(binding: KvBindingLike): KvLike {
  return {
    get: (k) => binding.get(k, 'text'),
    put: (k, v, o) => binding.put(k, v, o),
    delete: (k) => binding.delete(k),
  };
}

function resolveKv(): KvLike {
  // No dedicated SESSIONS_KV namespace is provisioned; reuse the durable CACHE_KV
  // binding so checkout sessions survive across requests/isolates on Workers. The
  // in-memory fallback is isolate-local and silently loses sessions in production.
  const binding = getBinding<KvBindingLike>('SESSIONS_KV') ?? getBinding<KvBindingLike>('CACHE_KV');
  if (binding) return kvFromBinding(binding);
  const cache = getMemoryCache();
  return {
    get: (k) => cache.get<string>(k),
    put: (k, v, o) => cache.set(k, v, o?.expirationTtl),
    delete: (k) => cache.delete(k),
  };
}

// Backend adapters load asynchronously, so the read-side port is built lazily and cached per
// isolate. The deps function itself stays synchronous for the request/render hot path.
// Memoized per country: presentment pricing is country-contextual, so the live read side must be
// built for the buyer's country. The underlying live catalog cache bounds the actual API calls.
const catalogReadSideByCountry = new Map<string, Promise<GatewayCatalogReadPort>>();
function gatewayCatalog(country = 'US'): Promise<GatewayCatalogReadPort> {
  const key = country.toUpperCase();
  let port = catalogReadSideByCountry.get(key);
  if (!port) {
    port = makeCommerceGatewayReadSide(key);
    catalogReadSideByCountry.set(key, port);
  }
  return port;
}

let submitHandoff: Promise<SubmitHandoffService> | null = null;
function gatewayHandoff(): Promise<SubmitHandoffService> {
  return (submitHandoff ??= makeSubmitHandoffService());
}

function makePaymentsPort(request?: CheckoutRequestInfo): StorefrontCheckoutDeps['paymentsPort'] {
  return {
    async create(saleRef, amount, captureMethod, provider, checkoutSnapshot) {
      const slug = provider ?? 'STRIPE';
      const result = await makePaymentsCommand().create({
        saleRef: SaleRef.of(saleRef),
        amount,
        captureMethod,
        provider: slug,
        checkoutSnapshot: snapshotWithReturnTargets(checkoutSnapshot, request),
        context: buildPaymentRequestContext({ slug, saleRef, snapshot: checkoutSnapshot, request }),
      });
      // PayPal's JS SDK createOrder needs the PayPal order id (providerIntentId); every other provider
      // hands its client handle (Stripe client_secret, hosted-page URL) to the matching widget.
      return { clientHandle: slug === 'PAYPAL' ? result.providerIntentId : result.clientHandle.value };
    },
  };
}

function makeCatalogPort(market: { countryCode: string; currencyCode: string }): StorefrontCheckoutDeps['catalogPort'] {
  return {
    async resolve(ids, requested): Promise<PurchasableDto[]> {
      const m = requested ?? market;
      const port = await gatewayCatalog(m.countryCode);
      const purchasables = await port.resolvePurchasables({
        variantRefs: ids.map((id) => ExternalRef.of(id)),
        market: Market.of(m.countryCode, m.currencyCode),
      });
      const byRef = new Map(purchasables.map((p) => [p.variantRef.toString(), p]));
      return ids.map((variantExternalId) => {
        const p = byRef.get(variantExternalId);
        const price = p?.price ?? null;
        return {
          variantExternalId,
          title: p?.title ?? '',
          price: price ? { amountMinor: price.amountMinor, currencyCode: price.currencyCode } : null,
          sellable: isSellablePurchasable(p),
        };
      });
    },
  };
}

function toHandoffCommand(payload: HandoffPayload): SubmitHandoffCommand {
  const currencyCode = payload.grandTotal.currencyCode;
  return {
    saleRef: payload.saleRef,
    capturedTotalMinor: payload.grandTotal.amountMinor,
    currencyCode,
    lines: payload.lines.map((l) => ({
      variantRef: l.variantExternalId,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
      currencyCode,
    })),
    ...(payload.appliedDiscount ? { appliedDiscount: payload.appliedDiscount } : {}),
    customer: payload.customer as unknown as Record<string, unknown>,
  };
}

function makeHandoffPort(): StorefrontCheckoutDeps['handoffPort'] {
  return {
    async submit(payload) {
      const service = await gatewayHandoff();
      const result = await service.execute(toHandoffCommand(payload));
      if (result.status !== 'succeeded' || !result.backendOrderRef) {
        throw new Error(`commerce handoff ${result.status} for sale ${payload.saleRef}`);
      }
      return { backendRef: result.backendOrderRef };
    },
  };
}

function makePaymentSnapshotReader(): StorefrontCheckoutDeps['paymentSnapshots'] {
  return {
    async loadBySaleRef(saleRef) {
      const view = await makePaymentsQuery().getCapturedBySaleRef(saleRef);
      if (!view) return null;
      return {
        status: view.status,
        capturedAmountMinor: view.capturedAmountMinor,
        currencyCode: view.currencyCode,
        checkoutSnapshot: (view.checkoutSnapshot as CheckoutSnapshot | null) ?? null,
      };
    },
    async updateCheckoutSnapshot(saleRef, snapshot) {
      await makePaymentsQuery().updateCheckoutSnapshotBySaleRef(saleRef, snapshot);
    },
  };
}

function makeJobQueue(locals: CfLocals): StorefrontCheckoutDeps['jobQueue'] {
  return {
    async enqueue(kind, idempotencyKey, payload) {
      await makePlatform(locals).enqueueJob.enqueue({
        kind,
        idempotencyKey: idempotencyKey.value,
        payload,
        dispatch: 'INLINE_WAIT_UNTIL',
        maxAttempts: 5,
      });
    },
  };
}

function makeCouponReader(): StorefrontCheckoutDeps['couponReader'] {
  return {
    async findByCode(code): Promise<CouponDefinition | null> {
      const coupon = await new PrismaCouponRepository(getTenantPrisma() as never, getCurrentTenantId).findByCode(code);
      if (!coupon) return null;
      if (!coupon.isActive || coupon.isExpired(new Date()) || coupon.isExhausted()) return null;
      return toCouponDefinition(coupon);
    },
  };
}

function makeCouponRedemptionDeps(defaultCurrency: string): CouponRedemptionDeps {
  return {
    rates: (cartCurrency) => couponRatesFor(readCurrencyRates, cartCurrency, defaultCurrency),
    evaluate: (code, baseSubtotalMinor, now) => makeCoupons().evaluate(code, baseSubtotalMinor, now),
  };
}

// Submit-time re-check against the authoritative coupon record (the session snapshot can be stale,
// e.g. the coupon hit maxUsages between apply and submit).
function makeCouponGuard(defaultCurrency: string): StorefrontCheckoutDeps['couponGuard'] {
  const deps = makeCouponRedemptionDeps(defaultCurrency);
  return {
    async assertRedeemable(code, subtotalMinor, currencyCode, now): Promise<void> {
      await assertRedeemableInCartCurrency(deps, code, subtotalMinor, currencyCode, now);
    },
  };
}

// Storefront coupon preview (GET /api/shop/coupon): same conversion as the session apply.
// '' / null currency means the store default.
export function previewStorefrontCoupon(code: string, subtotalMinor: number, currencyCode: string | null): Promise<CouponPreview> {
  const defaultCurrency = checkoutMarket(getRuntimeEnv()).currencyCode;
  return previewCoupon(makeCouponRedemptionDeps(defaultCurrency), code, subtotalMinor, currencyCode || defaultCurrency, new Date());
}

export const CHECKOUT_SESSION_COOKIE = 'an_checkout_session';

// The cart currency of the shopper's checkout session, when a valid session cookie is present.
export async function checkoutSessionCurrency(cookieValue: string | null, locals?: unknown): Promise<string | null> {
  if (!cookieValue) return null;
  try {
    const sessions = makeStorefrontCheckout(storefrontCheckoutDepsFromLocals(locals)).sessions;
    const sessionId = await sessions.verifyCookieValue(cookieValue);
    if (!sessionId) return null;
    return (await sessions.load(sessionId))?.market.currencyCode ?? null;
  } catch (err) {
    logger.warn('Checkout session currency lookup failed', { error: err });
    return null;
  }
}

// commerce.handoff is enqueued by the payment.captured event handler; EnqueueJobService throws unless a
// handler is registered first. Registration runs at module load (request path) and is re-asserted in
// the cron drain. Deps are built inside the handler so they resolve against the active ALS tenant.
let handlersRegistered = false;
export function registerStorefrontHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;
  registerJobHandler('commerce.handoff', async (payload) => {
    const { saleRef } = (payload ?? {}) as { saleRef?: string };
    if (!saleRef) {
      logger.warn('commerce.handoff job missing saleRef; skipping');
      return;
    }
    await executeHandoffForSale(saleRef, makeHandoffForSaleDeps());
  });
}

function buyerToCustomer(buyer: CheckoutSnapshot['buyer']): Record<string, unknown> {
  return {
    fullName: buyer.fullName,
    hashedIdentity: buyer.hashedIdentity,
    shippingAddress: buyer.address,
    email: buyer.channel === 'email' ? buyer.normalized : undefined,
  };
}

// Split fulfillment needs the parent autonnel order number (for the tag) plus the upsell lines and
// buyer to push each as a standalone external order.
async function loadSplitContext(saleRef: string): Promise<SplitContext | null> {
  const view = await makePaymentSnapshotReader().loadBySaleRef(saleRef);
  const snapshot = view?.checkoutSnapshot;
  if (!snapshot) return null;
  const order = await new PrismaOrderRepository(getTenantPrisma() as never).findBySaleRef(saleRef);
  if (!order) return null;
  const upsellLines = snapshot.lines
    .filter((l) => l.upsellIndex !== undefined)
    .map((l) => ({
      upsellIndex: l.upsellIndex as number,
      line: { variantExternalId: l.variantExternalId, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, currencyCode: l.currencyCode },
    }));
  return { orderNumber: order.orderNumber, customer: buyerToCustomer(snapshot.buyer), upsellLines };
}

function makeHandoffForSaleDeps(): HandoffForSaleDeps {
  const consumers = makeStorefrontConsumersForJob();
  return {
    getFulfillmentMode,
    runMergedHandoff: (saleRef) => consumers.handoffHandler.execute(saleRef),
    runBaseOnlyHandoff: (saleRef) => consumers.handoffHandler.execute(saleRef, (l) => l.upsellIndex === undefined),
    loadSplitContext,
    pushIndependentUpsell: submitIndependentUpsell,
  };
}

function makeStorefrontConsumersForJob() {
  const deps = storefrontCheckoutDepsFromLocals();
  return makeStorefrontConsumers({
    prisma: deps.prisma,
    tenantId: deps.tenantId,
    handoffPort: deps.handoffPort,
    eventPublisher: deps.eventPublisher,
    jobQueue: deps.jobQueue,
    paymentSnapshots: deps.paymentSnapshots,
  });
}

registerStorefrontHandlers();

export function storefrontCheckoutDepsFromLocals(locals?: unknown, request?: CheckoutRequestInfo): StorefrontCheckoutDeps {
  const env = getRuntimeEnv();
  const cfLocals = (locals ?? {}) as CfLocals;
  const tenantEvents = new TenantEventPublisher(new OutboxEventPublisher(getBasePrisma()));
  const market = checkoutMarket(env);
  const prisma = getTenantPrisma() as unknown as PrismaClient;
  return {
    prisma,
    kv: resolveKv(),
    tenantId: getCurrentTenantId(),
    cookieSecret: resolveSessionSecret(['CHECKOUT_COOKIE_SECRET', 'AUTH_SESSION_SECRET'], env),
    paymentsPort: makePaymentsPort(request),
    catalogPort: makeCatalogPort(market),
    handoffPort: makeHandoffPort(),
    publicationPort: new PrismaPublicationReader(prisma, (slug) => publishFunnelForStep(prisma, slug)),
    eventPublisher: { publish: (events) => Promise.all(events.map((e) => tenantEvents.publish(e))).then(() => undefined) },
    jobQueue: makeJobQueue(cfLocals),
    // TODO: bridge to analytics attribution once sessionId→landing/clickIds lookup exists.
    attributionPort: { async read() { return null; } },
    paymentSnapshots: makePaymentSnapshotReader(),
    couponReader: makeCouponReader(),
    couponGuard: makeCouponGuard(market.currencyCode),
    couponRates: makeCouponRedemptionDeps(market.currencyCode).rates,
    market,
    resolveMarket: (currency) => marketForCurrency(currency, env),
    sessionTtlSeconds: 3600,
    maxPriceAgeMs: 300000,
  };
}
