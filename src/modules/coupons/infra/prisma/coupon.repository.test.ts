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

const tenant = () => 't1';

describe('PrismaCouponRepository', () => {
  it('maps a decimal row to a Coupon with numeric value', async () => {
    const repo = new PrismaCouponRepository({ coupon: { findFirst: vi.fn().mockResolvedValue(row) } } as never, tenant);
    const c = await repo.findByCode('WELCOME10');
    expect(c).toBeInstanceOf(Coupon);
    expect(c?.discountValue).toBe(10);
    expect(c?.code).toBe('WELCOME10');
  });

  it('serializes domain to data on create', async () => {
    const create = vi.fn().mockResolvedValue(row);
    const repo = new PrismaCouponRepository({ coupon: { create } } as never, tenant);
    const coupon = Coupon.create({ tenantId: 't1', name: 'Welcome', code: 'welcome10', discountType: 'PERCENTAGE', discountValue: 10 });
    await repo.create(coupon);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: 'WELCOME10', discountType: 'PERCENTAGE', discountValue: 10 }),
    });
  });
});

describe('PrismaCouponRepository.incrementUsage — conditional and atomic', () => {
  function repoWith(rowsReturned: { id: string }[]) {
    const captured: { sql?: string; params?: unknown[] } = {};
    const db = {
      $queryRawUnsafe: async (sql: string, ...params: unknown[]) => {
        captured.sql = sql;
        captured.params = params;
        return rowsReturned;
      },
    };
    return { repo: new PrismaCouponRepository(db as never, tenant), captured };
  }

  it('returns true when a row was advanced', async () => {
    const { repo } = repoWith([{ id: 'c1' }]);
    expect(await repo.incrementUsage('SAVE10')).toBe(true);
  });

  it('returns false when the cap was already reached', async () => {
    const { repo } = repoWith([]);
    expect(await repo.incrementUsage('SAVE10')).toBe(false);
  });

  it('guards the increment with the cap and scopes it to the tenant', async () => {
    const { repo, captured } = repoWith([{ id: 'c1' }]);
    await repo.incrementUsage('SAVE10');
    expect(captured.sql).toContain('"usageCount" < "maxUsages"');
    expect(captured.sql).toContain('"maxUsages" IS NULL');
    expect(captured.sql).toContain('"tenantId" = $1');
    expect(captured.params).toEqual(['t1', 'SAVE10']);
  });
});
