import { describe, it, expect } from 'vitest';
import { Money } from '@/modules/shared-kernel/money';
import { AppliedCoupon } from './applied-coupon';

describe('AppliedCoupon', () => {
  it('creates a percentage coupon', () => {
    const c = AppliedCoupon.create('SAVE10', 'percentage', Money.of(199, 'USD'));
    expect(c.code).toBe('SAVE10');
    expect(c.kind).toBe('percentage');
    expect(c.discount.amountMinor).toBe(199);
  });

  it('creates a fixed coupon and trims the code', () => {
    const c = AppliedCoupon.create('  FLAT5  ', 'fixed', Money.of(500, 'USD'));
    expect(c.code).toBe('FLAT5');
    expect(c.kind).toBe('fixed');
  });

  it('rejects a blank code', () => {
    expect(() => AppliedCoupon.create('   ', 'fixed', Money.of(500, 'USD'))).toThrow(/code/i);
  });

  it('rejects a negative discount', () => {
    expect(() => AppliedCoupon.create('NEG', 'fixed', Money.of(-1, 'USD'))).toThrow(/>= 0/i);
  });
});
