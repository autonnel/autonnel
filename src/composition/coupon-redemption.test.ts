import { describe, it, expect, vi } from 'vitest';
import { ShopifyCatalogAdapter } from '@/modules/commerce-gateway/infra/backends/shopify/catalog-adapter';
import { ShopifyGraphqlClient } from '@/modules/commerce-gateway/infra/backends/shopify/shopify-graphql-client';
import { createCurrencyRatesReader } from './make-commerce-gateway';
import { CouponNotRedeemableError } from '@/modules/storefront-checkout/application/submit-checkout-service';
import { assertRedeemableInCartCurrency, couponRatesFor, previewCoupon, type CouponRecord, type CouponRedemptionDeps } from './coupon-redemption';

const now = new Date('2026-10-24T00:00:00Z');
const usdRates = { baseCurrency: 'USD', rates: { EUR: 0.9 } };
const fixed10: CouponRecord = { code: 'TEN', discountType: 'FIXED_AMOUNT', discountValue: 10, minOrderAmount: null };
const pct10min50: CouponRecord = { code: 'PCT', discountType: 'PERCENTAGE', discountValue: 10, minOrderAmount: 50 };
const pct10: CouponRecord = { code: 'P10', discountType: 'PERCENTAGE', discountValue: 10, minOrderAmount: null };

// Mirrors Coupon.evaluate's min check in base minor units.
function deps(coupon: CouponRecord | null, rates: CouponRedemptionDeps['rates']) {
  const evaluate = vi.fn(async (_code: string, subtotalMinor: number) => {
    if (!coupon) return { valid: false, error: 'Coupon not found' };
    if (coupon.minOrderAmount !== null && subtotalMinor < coupon.minOrderAmount * 100) return { valid: false, error: `Order must be at least ${coupon.minOrderAmount}`, coupon };
    return { valid: true, coupon };
  });
  return { rates, evaluate };
}

describe('couponRatesFor', () => {
  it('uses backend rates when present', async () => {
    expect(await couponRatesFor(async () => usdRates, 'EUR', 'USD')).toEqual(usdRates);
  });

  it('treats the store default currency as base when the backend has no rates', async () => {
    expect(await couponRatesFor(async () => null, 'usd', 'USD')).toEqual({ baseCurrency: 'USD', rates: {} });
    expect(await couponRatesFor(async () => null, 'EUR', 'USD')).toBeNull();
  });

  it('never synthesizes a base when the rates read failed', async () => {
    expect(await couponRatesFor(async () => { throw new Error('picocart down'); }, 'USD', 'USD')).toBeNull();
  });
});

describe('assertRedeemableInCartCurrency', () => {
  it('re-checks the minimum with the subtotal converted back to base', async () => {
    const d = deps(pct10min50, async () => usdRates);
    // 50 USD minimum = 4500 EUR minor.
    await expect(assertRedeemableInCartCurrency(d, 'PCT', 4500, 'EUR', now)).resolves.toMatchObject({ definition: { minSubtotalMinor: 4500 } });
    expect(d.evaluate).toHaveBeenCalledWith('PCT', 5000, now);
    await expect(assertRedeemableInCartCurrency(d, 'PCT', 4499, 'EUR', now)).rejects.toThrow(CouponNotRedeemableError);
  });

  it('returns the fixed coupon converted to the cart currency', async () => {
    const { definition } = await assertRedeemableInCartCurrency(deps(fixed10, async () => usdRates), 'TEN', 2000, 'EUR', now);
    expect(definition.value).toBe(900);
  });

  it('rejects fixed and minimum coupons without a rate', async () => {
    for (const c of [fixed10, pct10min50]) {
      const p = assertRedeemableInCartCurrency(deps(c, async () => null), c.code, 100000, 'EUR', now);
      await expect(p).rejects.toThrow(CouponNotRedeemableError);
      await expect(p).rejects.toThrow('Coupon is not available for this currency');
    }
  });

  it('keeps percentage coupons without minimum when no rate', async () => {
    const { definition } = await assertRedeemableInCartCurrency(deps(pct10, async () => null), 'P10', 2000, 'EUR', now);
    expect(definition).toMatchObject({ kind: 'percentage', value: 10 });
  });

  it('surfaces the authoritative invalid reason', async () => {
    await expect(assertRedeemableInCartCurrency(deps(null, async () => usdRates), 'X', 2000, 'USD', now)).rejects.toThrow('Coupon not found');
  });
});

describe('previewCoupon', () => {
  it('EUR preview returns the converted discount', async () => {
    const result = await previewCoupon(deps(fixed10, async () => usdRates), 'TEN', 2000, 'EUR', now);
    expect(result).toEqual({ valid: true, discountMinor: 900, definition: expect.objectContaining({ value: 900 }), coupon: fixed10 });
  });

  it('matches the session apply percentage rounding', async () => {
    const result = await previewCoupon(deps(pct10, async () => usdRates), 'P10', 1995, 'EUR', now);
    expect(result).toMatchObject({ valid: true, discountMinor: 199 });
  });

  it('no-rate non-default currency returns invalid', async () => {
    const result = await previewCoupon(deps(fixed10, async () => null), 'TEN', 2000, 'EUR', now);
    expect(result).toEqual({ valid: false, error: 'Coupon is not available for this currency' });
  });
});

describe('previewCoupon minimum', () => {
  it('returns the minimum converted into a non-base cart currency', async () => {
    const result = await previewCoupon(deps(pct10min50, async () => usdRates), 'PCT', 4499, 'EUR', now);
    expect(result).toMatchObject({ valid: false, minOrder: { amountMinor: 4500, currencyCode: 'EUR' } });
  });

  it('does not report a minimum for a coupon rejected for another reason', async () => {
    const inactive = { rates: async () => usdRates, evaluate: vi.fn(async () => ({ valid: false, error: 'Coupon is not active', coupon: pct10min50 })) };
    expect(await previewCoupon(inactive, 'PCT', 100, 'EUR', now)).toEqual({ valid: false, error: 'Coupon is not active' });
  });

  it('returns the minimum with its currency for a base-currency cart', async () => {
    const result = await previewCoupon(deps(pct10min50, async () => usdRates), 'PCT', 4999, 'USD', now);
    expect(result).toMatchObject({ valid: false, minOrder: { amountMinor: 5000, currencyCode: 'USD' } });
  });
});

describe('picocart resolver failure end to end', () => {
  it('200 + errors body fails the read, is not cached, and rejects a coupon needing a rate', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ message: 'db down' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { currencyRates: { baseCurrency: 'EUR', rates: [{ currencyCode: 'USD', rate: 1.1 }] } } }), { status: 200 }));
    const adapter = new ShopifyCatalogAdapter(new ShopifyGraphqlClient({ shopDomain: 's', accessToken: 't', apiVersion: 'v' }, fetchFn), 'US');
    const read = createCurrencyRatesReader(() => adapter.currencyRates(), 60_000, () => 0);
    const d = deps(fixed10, (cart) => couponRatesFor(() => read('t1'), cart, 'USD'));

    // Default-currency cart: a failed read must not fall back to "coupon is in USD".
    await expect(assertRedeemableInCartCurrency(d, 'TEN', 2000, 'USD', now)).rejects.toThrow('Coupon is not available for this currency');
    // Not cached: the next read reaches the backend and converts with its real base (EUR).
    const { definition } = await assertRedeemableInCartCurrency(d, 'TEN', 2000, 'USD', now);
    expect(definition.value).toBe(1100);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
