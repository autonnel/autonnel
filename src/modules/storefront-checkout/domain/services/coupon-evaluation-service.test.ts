import { describe, it, expect } from 'vitest';
import { Money } from '@/modules/shared-kernel/money';
import { CouponEvaluationService, SubtotalBelowMinimumError } from './coupon-evaluation-service';

describe('CouponEvaluationService', () => {
  const svc = new CouponEvaluationService();

  it('computes a percentage discount against the subtotal', () => {
    const applied = svc.evaluate({ code: 'SAVE10', kind: 'percentage', value: 10, minSubtotalMinor: 0 }, Money.of(2000, 'USD'));
    expect(applied.discount.amountMinor).toBe(200);
    expect(applied.kind).toBe('percentage');
  });

  it('computes a fixed discount capped at the subtotal', () => {
    const applied = svc.evaluate({ code: 'F', kind: 'fixed', value: 5000, minSubtotalMinor: 0 }, Money.of(2000, 'USD'));
    expect(applied.discount.amountMinor).toBe(2000);
  });

  it('rejects when the subtotal is below minSubtotal', () => {
    expect(() =>
      svc.evaluate({ code: 'F', kind: 'fixed', value: 100, minSubtotalMinor: 5000 }, Money.of(2000, 'USD')),
    ).toThrow(/minimum/i);
  });

  it('reports the minimum in the cart currency when the subtotal is below it', () => {
    let caught: unknown;
    try {
      svc.evaluate({ code: 'F', kind: 'fixed', value: 100, minSubtotalMinor: 6650 }, Money.of(6599, 'EUR'));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SubtotalBelowMinimumError);
    expect((caught as SubtotalBelowMinimumError).minOrder).toEqual({ amountMinor: 6650, currencyCode: 'EUR' });
    expect((caught as Error).message).toBe('Subtotal below coupon minimum');
  });
});
