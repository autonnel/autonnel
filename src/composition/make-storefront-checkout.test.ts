import { describe, it, expect, vi } from 'vitest';
import { makeStorefrontCheckout } from './make-storefront-checkout';

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
      market: { countryCode: 'US', currencyCode: 'USD' },
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
