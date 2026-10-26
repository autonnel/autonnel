import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  sessionCurrency: null as string | null,
  calls: [] as unknown[][],
  preview: { valid: true, discountMinor: 900, definition: { code: 'TEN', kind: 'fixed', value: 900, minSubtotalMinor: 0 }, coupon: { id: 'c1', code: 'TEN', discountType: 'FIXED_AMOUNT', discountValue: 10, minOrderAmount: null } } as unknown,
}));

vi.mock('@/composition/storefront-runtime', () => ({
  CHECKOUT_SESSION_COOKIE: 'an_checkout_session',
  checkoutSessionCurrency: async () => h.sessionCurrency,
  previewStorefrontCoupon: async (...args: unknown[]) => {
    h.calls.push(args);
    return h.preview;
  },
}));

import { GET } from '../coupon';

function ctx(query: string, cookie?: string) {
  return {
    request: new Request(`http://shop.test/api/shop/coupon?${query}`, { headers: cookie ? { cookie } : {} }),
    locals: {},
    params: {},
  } as never;
}

beforeEach(() => {
  h.sessionCurrency = null;
  h.calls = [];
});

describe('GET /api/shop/coupon currency', () => {
  it('EUR preview returns the converted discount', async () => {
    const res = await GET(ctx('code=TEN&subtotal=20&currency=EUR'));
    expect(h.calls[0]).toEqual(['TEN', 2000, 'EUR']);
    expect(await res.json()).toEqual({ valid: true, discount: 9, discountType: 'FIXED_AMOUNT', discountValue: 9, couponId: 'c1', code: 'TEN' });
  });

  it('prefers the checkout session currency over the query', async () => {
    h.sessionCurrency = 'GBP';
    await GET(ctx('code=TEN&subtotal=20&currency=EUR', 'an_checkout_session=signed'));
    expect(h.calls[0]).toEqual(['TEN', 2000, 'GBP']);
  });

  it('empty currency means the store default', async () => {
    await GET(ctx('code=TEN&subtotal=20&currency='));
    expect(h.calls[0]).toEqual(['TEN', 2000, null]);
  });

  it('no-rate non-default currency returns invalid', async () => {
    h.preview = { valid: false, error: 'Coupon is not available for this currency' };
    const res = await GET(ctx('code=TEN&subtotal=20&currency=EUR'));
    expect(await res.json()).toEqual({ valid: false, error: 'Coupon is not available for this currency' });
  });
});
