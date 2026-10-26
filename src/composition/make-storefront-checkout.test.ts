import { describe, it, expect, vi } from 'vitest';
import { makeStorefrontCheckout } from './make-storefront-checkout';

const baseDeps = (kv: any, paymentsPort: any) => ({
  prisma: {} as any,
  kv,
  tenantId: 'default',
  cookieSecret: 's3cr3t',
  paymentsPort,
  catalogPort: { resolve: vi.fn() } as any,
  handoffPort: { submit: vi.fn() } as any,
  publicationPort: { resolveByStepSlug: vi.fn(), resolvePinned: vi.fn() } as any,
  eventPublisher: { publish: vi.fn() } as any,
  jobQueue: { enqueue: vi.fn() } as any,
  attributionPort: { read: vi.fn() } as any,
  paymentSnapshots: { loadBySaleRef: vi.fn() } as any,
  couponReader: { findByCode: vi.fn() } as any,
  couponGuard: { assertRedeemable: vi.fn() } as any,
  couponRates: vi.fn(async () => null),
  market: { countryCode: 'US', currencyCode: 'USD' },
  resolveMarket: () => ({ countryCode: 'US', currencyCode: 'USD' }),
  sessionTtlSeconds: 3600,
  maxPriceAgeMs: 300000,
});

const eurSession = {
  sessionId: 'sess-1',
  tenantId: 'default',
  funnelId: 'f1',
  version: 1,
  stepSlugs: ['checkout'],
  currentStep: 'checkout',
  attribution: {},
  contact: null,
  buyer: null,
  linkedSaleId: null,
  market: { countryCode: 'DE', currencyCode: 'EUR' },
  cartLines: [{ variantExternalId: 'v1', title: 'T', quantity: 1, unitPriceMinor: 950, currencyCode: 'EUR', capturedAt: new Date().toISOString() }],
  coupon: null,
};

describe('deferred buyer placeholder country', () => {
  it('uses the session market country for an express submit', async () => {
    const store = new Map<string, string>([['session:default:sess-1', JSON.stringify(eurSession)]]);
    const kv = { get: async (k: string) => store.get(k) ?? null, put: async (k: string, v: string) => void store.set(k, v), delete: vi.fn() };
    const create = vi.fn(async () => ({ clientHandle: 'h' }));
    const surface = makeStorefrontCheckout(baseDeps(kv, { create }));
    await surface.submitCheckout.execute({ sessionId: 'sess-1', buyer: {}, captureMethod: 'automatic' as any });
    const snapshot = (create.mock.calls[0] as any[])[4];
    expect(snapshot.buyer.address.countryCode).toBe('DE');
  });

  it('quotes a EUR session total in EUR', async () => {
    const store = new Map<string, string>([['session:default:sess-1', JSON.stringify(eurSession)]]);
    const kv = { get: async (k: string) => store.get(k) ?? null, put: vi.fn(), delete: vi.fn() };
    const surface = makeStorefrontCheckout(baseDeps(kv, { create: vi.fn() }));
    const quote = await surface.quoteAuthoritativeTotal.execute('sess-1');
    expect(quote.currencyCode).toBe('EUR');
  });
});

describe('makeStorefrontCheckout', () => {
  it('wires the checkout action surface from injected dependencies', () => {
    const surface = makeStorefrontCheckout({
      prisma: {} as any,
      kv: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } as any,
      tenantId: 'default',
      cookieSecret: 's3cr3t',
      paymentsPort: { create: vi.fn() } as any,
      catalogPort: { resolve: vi.fn() } as any,
      handoffPort: { submit: vi.fn() } as any,
      publicationPort: { resolveByStepSlug: vi.fn(), resolvePinned: vi.fn() } as any,
      eventPublisher: { publish: vi.fn() } as any,
      jobQueue: { enqueue: vi.fn() } as any,
      attributionPort: { read: vi.fn() } as any,
      paymentSnapshots: { loadBySaleRef: vi.fn() } as any,
      couponReader: { findByCode: vi.fn() } as any,
      couponGuard: { assertRedeemable: vi.fn() } as any,
      couponRates: vi.fn(async () => null),
      market: { countryCode: 'US', currencyCode: 'USD' },
      resolveMarket: () => ({ countryCode: 'US', currencyCode: 'USD' }),
      sessionTtlSeconds: 3600,
      maxPriceAgeMs: 300000,
    });
    expect(typeof surface.submitCheckout.execute).toBe('function');
    expect(typeof surface.addToCart.execute).toBe('function');
    expect(typeof surface.applyCoupon.execute).toBe('function');
    expect(typeof surface.startSession.execute).toBe('function');
    expect(typeof surface.advanceStep.execute).toBe('function');
    expect(typeof surface.oneClickUpsell.execute).toBe('function');
  });
});
