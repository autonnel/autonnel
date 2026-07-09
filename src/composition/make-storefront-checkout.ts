import type { PrismaClient } from '@prisma/client';
import { EdgeKvSessionAdapter } from '@/modules/storefront-checkout/infra/edge-kv-session';
import { PaymentCaptureClient, type PaymentIntentCommandPort } from '@/modules/storefront-checkout/infra/clients/payment-capture-client';
import { CommerceCatalogClient, type CatalogReadPort } from '@/modules/storefront-checkout/infra/clients/commerce-catalog-client';
import { type CommerceHandoffInboundPort } from '@/modules/storefront-checkout/infra/clients/commerce-handoff-client';
import { FunnelSnapshotClient, type PublicationReadPort } from '@/modules/storefront-checkout/infra/clients/funnel-snapshot-client';
import { CheckoutAssemblyService } from '@/modules/storefront-checkout/domain/services/checkout-assembly-service';
import { WebCryptoHashIdentityAdapter } from '@/modules/storefront-checkout/infra/web-crypto-hash-identity';
import { BuyerContact, Address } from '@/modules/storefront-checkout/domain/value-objects/buyer-contact';
import { ContactHandle } from '@/modules/storefront-checkout/domain/value-objects/contact-handle';
import { DEFERRED_CONTACT_EMAIL, deferredAddress } from '@/modules/storefront-checkout/domain/value-objects/deferred-contact';
import type { CaptureMethod, CouponRedemptionGuardPort, PaymentProviderChoice } from '@/modules/storefront-checkout/application/ports/outbound';
import type { SubmitCheckoutResult } from '@/modules/storefront-checkout/application/ports/inbound';
import { StartFunnelSessionService } from '@/modules/storefront-checkout/application/start-funnel-session-service';
import { RenderFunnelStepService } from '@/modules/storefront-checkout/application/render-funnel-step-service';
import { AddToCartService } from '@/modules/storefront-checkout/application/add-to-cart-service';
import { ApplyCouponService, type CouponDefinitionReader } from '@/modules/storefront-checkout/application/apply-coupon-service';
import { SubmitCheckoutService } from '@/modules/storefront-checkout/application/submit-checkout-service';
import { AdvanceStepService } from '@/modules/storefront-checkout/application/advance-step-service';
import { ProcessOneClickUpsellService } from '@/modules/storefront-checkout/application/process-one-click-upsell-service';
import type { AttributionReaderPort, DomainEventPublisherPort, JobQueuePort, PaymentSnapshotReaderPort } from '@/modules/storefront-checkout/application/ports/outbound';

interface KvLike {
  get(k: string): Promise<string | null>;
  put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void>;
  delete(k: string): Promise<void>;
}

export interface StorefrontCheckoutDeps {
  prisma: PrismaClient;
  kv: KvLike;
  tenantId: string;
  cookieSecret: string;
  paymentsPort: PaymentIntentCommandPort;
  catalogPort: CatalogReadPort;
  handoffPort: CommerceHandoffInboundPort;
  publicationPort: PublicationReadPort;
  eventPublisher: DomainEventPublisherPort;
  jobQueue: JobQueuePort;
  attributionPort: AttributionReaderPort;
  paymentSnapshots: PaymentSnapshotReaderPort;
  couponReader: CouponDefinitionReader;
  couponGuard: CouponRedemptionGuardPort;
  market: { countryCode: string; currencyCode: string };
  sessionTtlSeconds: number;
  maxPriceAgeMs: number;
  hasher?: WebCryptoHashIdentityAdapter;
}

interface BuyerBody {
  fullName?: string;
  email?: string;
  phone?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    countryCode: string;
    postalCode: string;
  };
}

async function buildBuyerContact(
  body: BuyerBody,
  hasher: WebCryptoHashIdentityAdapter,
  fallbackCountry: string,
): Promise<BuyerContact> {
  // Express buyers (PayPal) carry no email/phone at submit; defer with a placeholder, backfilled at capture.
  if (!body.email && !body.phone) {
    const hash = await hasher.hasherFor(DEFERRED_CONTACT_EMAIL);
    const handle = ContactHandle.fromEmail(DEFERRED_CONTACT_EMAIL, hash);
    const address = Address.create(deferredAddress(fallbackCountry));
    return BuyerContact.create({ fullName: body.fullName ?? '', handle, address });
  }
  const normalized = (body.email ?? body.phone ?? '').trim().toLowerCase();
  const hash = await hasher.hasherFor(normalized); // compute the digest once for the synchronous submit path
  const handle = body.email
    ? ContactHandle.fromEmail(body.email, hash)
    : ContactHandle.fromPhone(body.phone ?? '', hash);
  const address = Address.create(
    body.address ?? { line1: '', city: '', countryCode: fallbackCountry, postalCode: '' },
  );
  return BuyerContact.create({ fullName: body.fullName ?? '', handle, address });
}

// Pricing ignores the buyer; this synchronous placeholder lets the authoritative-total
// quote run without the async identity hashing that the submit path needs.
function deferredBuyerForQuote(fallbackCountry: string): BuyerContact {
  const handle = ContactHandle.fromEmail(DEFERRED_CONTACT_EMAIL, () => 'quote');
  const address = Address.create(deferredAddress(fallbackCountry));
  return BuyerContact.create({ fullName: '', handle, address });
}

export function makeStorefrontCheckout(d: StorefrontCheckoutDeps) {
  const sessions = new EdgeKvSessionAdapter({ kv: d.kv, tenantId: d.tenantId, cookieSecret: d.cookieSecret });
  const payments = new PaymentCaptureClient(d.paymentsPort);
  const catalog = new CommerceCatalogClient(d.catalogPort);
  const snapshots = new FunnelSnapshotClient(d.publicationPort);
  const clock = () => new Date();
  const newId = () => crypto.randomUUID();
  const hasher = d.hasher ?? new WebCryptoHashIdentityAdapter();

  const assembly = new CheckoutAssemblyService();
  const submitService = new SubmitCheckoutService({ assembly, payments, publisher: d.eventPublisher, couponGuard: d.couponGuard, newSaleId: newId, clock, maxPriceAgeMs: d.maxPriceAgeMs });

  const submitCheckout = {
    async execute(input: { sessionId: string; buyer: BuyerBody; captureMethod: CaptureMethod; visitorId?: string | null; provider?: PaymentProviderChoice; locale?: string | null }): Promise<SubmitCheckoutResult> {
      const session = await sessions.load(input.sessionId);
      if (!session) throw new Error('FunnelSession not found');
      const buyer = await buildBuyerContact(input.buyer ?? {}, hasher, d.market.countryCode);
      const result = await submitService.execute({ session, buyer, coupon: session.cart.coupon, captureMethod: input.captureMethod, visitorId: input.visitorId ?? null, provider: input.provider, locale: input.locale ?? null });
      // Persist the session so the attached buyer + linked sale survive for the one-click upsell.
      await sessions.store(session, d.sessionTtlSeconds);
      return result;
    },
  };

  // Server-authoritative checkout total: priced from the session's cart + applied coupon,
  // never from any client-supplied amount. Callers (e.g. the payment-intent endpoint) must
  // use this rather than trusting a request body amount.
  const quoteAuthoritativeTotal = {
    async execute(sessionId: string): Promise<{ amountMinor: number; currencyCode: string }> {
      const session = await sessions.load(sessionId);
      if (!session) throw new Error('FunnelSession not found');
      const { capturedTotal } = assembly.assemble({
        session,
        buyer: deferredBuyerForQuote(d.market.countryCode),
        coupon: session.cart.coupon,
        now: clock(),
        maxPriceAgeMs: d.maxPriceAgeMs,
      });
      return { amountMinor: capturedTotal.amountMinor, currencyCode: capturedTotal.currencyCode };
    },
  };

  return {
    startSession: new StartFunnelSessionService({ snapshots, attribution: d.attributionPort, sessions, newSessionId: newId, ttlSeconds: d.sessionTtlSeconds, tenantId: d.tenantId }),
    renderStep: new RenderFunnelStepService({ snapshots, attribution: d.attributionPort, sessions, newSessionId: newId, ttlSeconds: d.sessionTtlSeconds, tenantId: d.tenantId }),
    addToCart: new AddToCartService({ sessions, catalog, clock, ttlSeconds: d.sessionTtlSeconds, market: d.market }),
    applyCoupon: new ApplyCouponService({ sessions, coupons: d.couponReader, ttlSeconds: d.sessionTtlSeconds }),
    submitCheckout,
    quoteAuthoritativeTotal,
    advanceStep: new AdvanceStepService({ sessions, ttlSeconds: d.sessionTtlSeconds }),
    oneClickUpsell: new ProcessOneClickUpsellService({ sessions, catalog, payments, publisher: d.eventPublisher, newSaleId: newId, clock, market: d.market }),
    sessions,
  };
}
