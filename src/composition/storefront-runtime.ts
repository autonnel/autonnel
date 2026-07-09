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
import type { CatalogReadPort as GatewayCatalogReadPort, SubmitHandoffCommand } from '@/modules/commerce-gateway/application/ports/inbound';
import type { SubmitHandoffService } from '@/modules/commerce-gateway/application/submit-handoff.service';
import type { PurchasableDto } from '@/modules/storefront-checkout/infra/clients/commerce-catalog-client';
import type { HandoffPayload } from '@/modules/storefront-checkout/domain/services/handoff-payload-assembler';
import type { CouponDefinition } from '@/modules/storefront-checkout/domain/services/coupon-evaluation-service';
import { CouponNotRedeemableError } from '@/modules/storefront-checkout/application/submit-checkout-service';
import { makeCoupons } from './make-coupons';
import { makePaymentsCommand, makePaymentsQuery } from './make-payments';
import type { CheckoutSnapshot } from '@/modules/storefront-checkout/application/checkout-snapshot';
import { makeCommerceGatewayReadSide, makeSubmitHandoffService } from './make-commerce-gateway';
import { PrismaOrderRepository } from '@/modules/order-fulfillment/infra/prisma/order.repository';
import { getFulfillmentMode } from '@/lib/config/ecommerce';
import { executeHandoffForSale, submitIndependentUpsell } from './handoff-coordinator';
import type { HandoffForSaleDeps, SplitContext } from './handoff-coordinator';
import { makePlatform, registerJobHandler } from './make-platform';
import { makeStorefrontConsumers } from './make-storefront-consumers';
import type { StorefrontCheckoutDeps } from './make-storefront-checkout';

const logger = createLogger('StorefrontRuntime');
const MAJOR_TO_MINOR = 100;

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

function makePaymentsPort(): StorefrontCheckoutDeps['paymentsPort'] {
  return {
    async create(saleRef, amount, captureMethod, provider, checkoutSnapshot) {
      const slug = provider ?? 'STRIPE';
      const result = await makePaymentsCommand().create({
        saleRef: SaleRef.of(saleRef),
        amount,
        captureMethod,
        provider: slug,
        checkoutSnapshot,
      });
      // PayPal's JS SDK createOrder needs the PayPal order id (providerIntentId); Stripe needs the
      // client_secret. clientHandle is the per-provider handle the matching client widget consumes.
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
          // Sell unless inventory is explicitly unavailable; "unknown"/stale inventory
          // stays purchasable (matches the storefront product display).
          sellable: !!p && p.sellability.verdict !== 'unavailable' && price !== null,
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

function toCouponDefinition(c: {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderAmount: number | null;
}): CouponDefinition {
  return {
    code: c.code,
    kind: c.discountType === 'PERCENTAGE' ? 'percentage' : 'fixed',
    // percentage stays as the raw percent; fixed value is stored in major units → minor.
    value: c.discountType === 'PERCENTAGE' ? c.discountValue : Math.round(c.discountValue * MAJOR_TO_MINOR),
    minSubtotalMinor: c.minOrderAmount === null ? 0 : Math.round(c.minOrderAmount * MAJOR_TO_MINOR),
  };
}

function makeCouponReader(): StorefrontCheckoutDeps['couponReader'] {
  return {
    async findByCode(code): Promise<CouponDefinition | null> {
      const coupon = await new PrismaCouponRepository(getTenantPrisma()).findByCode(code);
      if (!coupon) return null;
      if (!coupon.isActive || coupon.isExpired(new Date()) || coupon.isExhausted()) return null;
      return toCouponDefinition(coupon);
    },
  };
}

// Submit-time re-check against the authoritative coupon record (the session snapshot can be stale,
// e.g. the coupon hit maxUsages between apply and submit).
function makeCouponGuard(): StorefrontCheckoutDeps['couponGuard'] {
  return {
    async assertRedeemable(code, subtotalMinor, now): Promise<void> {
      const result = await makeCoupons().evaluate(code, subtotalMinor, now);
      if (!result.valid) throw new CouponNotRedeemableError(result.error ?? 'Coupon is not redeemable');
    },
  };
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

export function storefrontCheckoutDepsFromLocals(locals?: unknown): StorefrontCheckoutDeps {
  const env = getRuntimeEnv();
  const cfLocals = (locals ?? {}) as CfLocals;
  const tenantEvents = new TenantEventPublisher(new OutboxEventPublisher(getBasePrisma()));
  const market = {
    countryCode: (env.DEFAULT_COUNTRY as string | undefined) ?? 'US',
    currencyCode: (env.DEFAULT_CURRENCY as string | undefined) ?? 'USD',
  };
  return {
    prisma: getTenantPrisma() as unknown as PrismaClient,
    kv: resolveKv(),
    tenantId: getCurrentTenantId(),
    cookieSecret: resolveSessionSecret('CHECKOUT_COOKIE_SECRET', env),
    paymentsPort: makePaymentsPort(),
    catalogPort: makeCatalogPort(market),
    handoffPort: makeHandoffPort(),
    publicationPort: new PrismaPublicationReader(getTenantPrisma() as unknown as PrismaClient),
    eventPublisher: { publish: (events) => Promise.all(events.map((e) => tenantEvents.publish(e))).then(() => undefined) },
    jobQueue: makeJobQueue(cfLocals),
    // TODO: bridge to analytics attribution once sessionId→landing/clickIds lookup exists.
    attributionPort: { async read() { return null; } },
    paymentSnapshots: makePaymentSnapshotReader(),
    couponReader: makeCouponReader(),
    couponGuard: makeCouponGuard(),
    market,
    sessionTtlSeconds: 3600,
    maxPriceAgeMs: 300000,
  };
}
