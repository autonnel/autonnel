import { describe, it, expect, vi } from 'vitest';
import { PrismaCouponRepository } from './coupon.repository';
import { Coupon } from '../../domain/coupon';

const row = {
  id: 'c1',
  tenantId: 't1',
  name: 'Welcome',
  code: 'WELCOME10',
  discountType: 'PERCENTAGE' as const,
  discountValue: { toString: () => '10' },
  minOrderAmount: null,
  maxUsages: null,
  usageCount: 0,
  isActive: true,
  expiresAt: null,
  createdAt: new Date('2026-06-06T00:00:00Z'),
};

describe('PrismaCouponRepository', () => {
  it('maps a decimal row to a Coupon with numeric value', async () => {
    const repo = new PrismaCouponRepository({ coupon: { findFirst: vi.fn().mockResolvedValue(row) } } as never);
    const c = await repo.findByCode('WELCOME10');
    expect(c).toBeInstanceOf(Coupon);
    expect(c?.discountValue).toBe(10);
    expect(c?.code).toBe('WELCOME10');
  });

  it('serializes domain to data on create', async () => {
    const create = vi.fn().mockResolvedValue(row);
    const repo = new PrismaCouponRepository({ coupon: { create } } as never);
    const coupon = Coupon.create({ tenantId: 't1', name: 'Welcome', code: 'welcome10', discountType: 'PERCENTAGE', discountValue: 10 });
    await repo.create(coupon);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: 'WELCOME10', discountType: 'PERCENTAGE', discountValue: 10 }),
    });
  });

  it('atomically increments usageCount by code', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repo = new PrismaCouponRepository({ coupon: { updateMany } } as never);
    await repo.incrementUsage('ONCE');
    expect(updateMany).toHaveBeenCalledWith({ where: { code: 'ONCE' }, data: { usageCount: { increment: 1 } } });
  });
});
