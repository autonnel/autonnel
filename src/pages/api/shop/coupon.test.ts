import { describe, it, expect, vi, beforeEach } from 'vitest';

const previewStorefrontCoupon = vi.fn();
const checkoutSessionCurrency = vi.fn();

vi.mock('@/composition/storefront-runtime', () => ({
  CHECKOUT_SESSION_COOKIE: 'an_checkout_session',
  previewStorefrontCoupon: (...args: unknown[]) => previewStorefrontCoupon(...args),
  checkoutSessionCurrency: (...args: unknown[]) => checkoutSessionCurrency(...args),
}));

import { GET } from './coupon';

async function call(qs: string) {
  const request = new Request(`https://shop.test/api/shop/coupon?${qs}`);
  const res = await (GET as any)({ request, params: {}, locals: {}, url: new URL(request.url) });
  return res.json();
}

describe('GET /api/shop/coupon', () => {
  beforeEach(() => {
    previewStorefrontCoupon.mockReset();
    checkoutSessionCurrency.mockReset();
    checkoutSessionCurrency.mockResolvedValue(null);
  });

  it('returns the converted minimum with its currency when the cart is below it', async () => {
    previewStorefrontCoupon.mockResolvedValue({
      valid: false,
      error: 'Order must be at least 70',
      minOrder: { amountMinor: 6650, currencyCode: 'EUR' },
    });
    const body = await call('code=MIN70&subtotal=65.99&currency=EUR');
    expect(previewStorefrontCoupon).toHaveBeenCalledWith('MIN70', 6599, 'EUR');
    expect(body).toEqual({ valid: false, error: 'Order must be at least 70', minOrder: { amountMinor: 6650, currencyCode: 'EUR' } });
  });

  it('omits minOrder for other rejections', async () => {
    previewStorefrontCoupon.mockResolvedValue({ valid: false, error: 'Coupon has expired' });
    expect(await call('code=OLD&subtotal=10')).toEqual({ valid: false, error: 'Coupon has expired' });
  });
});
