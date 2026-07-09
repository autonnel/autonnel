import { describe, it, expect, vi } from 'vitest';
import { Coupon } from '../domain/coupon';
import { ManageCouponsService } from './manage-coupons.service';
import type { CouponRepository } from './ports';

function makeRepo(overrides: Partial<CouponRepository> = {}): CouponRepository {
  return {
    list: vi.fn(),
    findById: vi.fn(),
    findByCode: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    incrementUsage: vi.fn(),
    ...overrides,
  } as CouponRepository;
}

const now = new Date('2026-06-14T00:00:00Z');

function couponWithUsage(usageCount: number, maxUsages: number | null): Coupon {
  return Coupon.rehydrate({
    id: 'c1', tenantId: 't1', name: 'Once', code: 'ONCE', discountType: 'PERCENTAGE', discountValue: 10,
    minOrderAmount: null, maxUsages, usageCount, isActive: true, expiresAt: null, createdAt: now,
  });
}

describe('ManageCouponsService.redeem', () => {
  it('normalizes the code and increments usage once', async () => {
    const incrementUsage = vi.fn().mockResolvedValue(undefined);
    const svc = new ManageCouponsService(makeRepo({ incrementUsage }), () => 't1');

    await svc.redeem(' once ');

    expect(incrementUsage).toHaveBeenCalledTimes(1);
    expect(incrementUsage).toHaveBeenCalledWith('ONCE');
  });

  it('no-ops on an invalid code rather than throwing', async () => {
    const incrementUsage = vi.fn();
    const svc = new ManageCouponsService(makeRepo({ incrementUsage }), () => 't1');

    await expect(svc.redeem('bad code!')).resolves.toBeUndefined();
    expect(incrementUsage).not.toHaveBeenCalled();
  });
});

describe('ManageCouponsService.evaluate enforces maxUsages', () => {
  it('is valid while under the limit', async () => {
    const findByCode = vi.fn().mockResolvedValue(couponWithUsage(0, 1));
    const svc = new ManageCouponsService(makeRepo({ findByCode }), () => 't1');

    const result = await svc.evaluate('ONCE', 10_000, now);

    expect(result.valid).toBe(true);
    expect(result.discountMinor).toBe(1_000);
  });

  it('rejects once usageCount has reached maxUsages (second use blocked)', async () => {
    const findByCode = vi.fn().mockResolvedValue(couponWithUsage(1, 1));
    const svc = new ManageCouponsService(makeRepo({ findByCode }), () => 't1');

    const result = await svc.evaluate('ONCE', 10_000, now);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/limit/i);
  });
});
