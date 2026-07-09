import { describe, it, expect } from 'vitest';
import { Coupon, normalizeCode } from './coupon';

function pct(value: number, opts: Partial<Parameters<typeof Coupon.create>[0]> = {}) {
  return Coupon.create({ tenantId: 't1', name: 'n', code: 'save', discountType: 'PERCENTAGE', discountValue: value, ...opts });
}

describe('Coupon code normalization', () => {
  it('uppercases and trims', () => {
    expect(normalizeCode(' welcome10 ')).toBe('WELCOME10');
  });
  it('rejects disallowed characters', () => {
    expect(() => normalizeCode('bad code!')).toThrow();
  });
});

describe('Coupon validation', () => {
  it('rejects non-positive discount value', () => {
    expect(() => pct(0)).toThrow(/positive/);
  });
  it('rejects percentage over 100', () => {
    expect(() => pct(150)).toThrow(/100/);
  });
  it('rejects bad discount type', () => {
    expect(() => Coupon.create({ tenantId: 't1', name: 'n', code: 'c', discountType: 'NOPE', discountValue: 5 })).toThrow(/discountType/);
  });
});

describe('Coupon.evaluate (minor units)', () => {
  const now = new Date('2026-06-06T00:00:00Z');

  it('computes a percentage discount', () => {
    const c = pct(10);
    expect(c.evaluate(10_000, now)).toEqual({ valid: true, discountMinor: 1_000 });
  });

  it('computes a fixed discount and clamps to subtotal', () => {
    const c = Coupon.create({ tenantId: 't1', name: 'n', code: 'fix', discountType: 'FIXED_AMOUNT', discountValue: 5 });
    expect(c.evaluate(10_000, now).discountMinor).toBe(500);
    expect(c.evaluate(300, now).discountMinor).toBe(300);
  });

  it('rejects inactive, expired, exhausted and below-minimum', () => {
    expect(pct(10, { isActive: false }).evaluate(10_000, now).valid).toBe(false);
    expect(pct(10, { expiresAt: new Date('2020-01-01') }).evaluate(10_000, now).valid).toBe(false);
    expect(pct(10, { minOrderAmount: 200 }).evaluate(10_000, now).valid).toBe(false);

    const exhausted = Coupon.rehydrate({
      id: '1', tenantId: 't1', name: 'n', code: 'X', discountType: 'PERCENTAGE', discountValue: 10,
      minOrderAmount: null, maxUsages: 1, usageCount: 1, isActive: true, expiresAt: null, createdAt: now,
    });
    expect(exhausted.evaluate(10_000, now).valid).toBe(false);
  });
});
