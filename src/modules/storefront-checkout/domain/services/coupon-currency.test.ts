import { describe, it, expect } from 'vitest';
import { CouponCurrencyUnsupportedError, toBaseSubtotal, toCartCurrency } from './coupon-currency';

const rates = { baseCurrency: 'USD', rates: { EUR: 0.9, JPY: 150 } };
const fixed = { code: 'TEN', kind: 'fixed' as const, value: 1000, minSubtotalMinor: 0 };
const pct = { code: 'PCT', kind: 'percentage' as const, value: 10, minSubtotalMinor: 5000 };

describe('toCartCurrency', () => {
  it('converts fixed coupon', () => {
    expect(toCartCurrency(fixed, 'EUR', rates)).toEqual({ ...fixed, value: 900 });
  });

  it('converts min subtotal for percentage', () => {
    expect(toCartCurrency(pct, 'EUR', rates)).toEqual({ ...pct, value: 10, minSubtotalMinor: 4500 });
  });

  it('same currency unchanged', () => {
    expect(toCartCurrency(fixed, 'USD', rates)).toEqual(fixed);
    expect(toCartCurrency(pct, 'usd', rates)).toEqual(pct);
  });

  it('rejects fixed coupon without rate', () => {
    expect(() => toCartCurrency(fixed, 'EUR', null)).toThrow(CouponCurrencyUnsupportedError);
    expect(() => toCartCurrency(fixed, 'GBP', rates)).toThrow('Coupon is not available for this currency');
  });

  it('rejects percentage coupon with a minimum without rate', () => {
    expect(() => toCartCurrency(pct, 'GBP', rates)).toThrow(CouponCurrencyUnsupportedError);
  });

  it('keeps percentage coupon without minimum when no rate', () => {
    const noMin = { ...pct, minSubtotalMinor: 0 };
    expect(toCartCurrency(noMin, 'GBP', null)).toEqual(noMin);
  });
});

describe('toCartCurrency zero-decimal currencies', () => {
  const jpy = { baseCurrency: 'USD', rates: { JPY: 150.3, KRW: 1300.7 } };

  it('rounds a fixed discount down and a minimum up to whole units', () => {
    expect(toCartCurrency({ ...fixed, value: 333, minSubtotalMinor: 333 }, 'JPY', jpy)).toEqual({ ...fixed, value: 50000, minSubtotalMinor: 50100 });
  });

  it('never exceeds the promised value for other zero-decimal currencies', () => {
    const converted = toCartCurrency({ ...fixed, value: 1000 }, 'KRW', jpy);
    expect(converted.value % 100).toBe(0);
    expect(converted.value).toBeLessThanOrEqual(1000 * 1300.7);
    expect(converted.value).toBe(1300700);
  });
});

describe('toBaseSubtotal', () => {
  it('returns the subtotal unchanged in base currency', () => {
    expect(toBaseSubtotal(1234, 'USD', rates)).toBe(1234);
  });

  it('returns null without a rate', () => {
    expect(toBaseSubtotal(1234, 'GBP', rates)).toBeNull();
    expect(toBaseSubtotal(1234, 'EUR', null)).toBeNull();
  });

  it('agrees with the converted minimum at every boundary', () => {
    const boundaryRates = { baseCurrency: 'USD', rates: { EUR: 0.9, JPY: 150.3, GBP: 0.37 } };
    for (const currency of ['EUR', 'JPY', 'GBP']) {
      for (let min = 1; min < 3000; min += 7) {
        const converted = toCartCurrency({ ...pct, minSubtotalMinor: min }, currency, boundaryRates).minSubtotalMinor;
        for (const subtotal of [converted - 1, converted, converted + 1]) {
          if (subtotal < 0) continue;
          expect(toBaseSubtotal(subtotal, currency, boundaryRates)! >= min).toBe(subtotal >= converted);
        }
      }
    }
  });
});
