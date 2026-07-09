import { describe, it, expect, vi } from 'vitest';
import { Money } from '@/modules/shared-kernel/money';
import { ExternalRef } from '@/modules/shared-kernel/external-ref';
import { FunnelSession } from '../domain/funnel-session';
import { AttributionSnapshot } from '../domain/value-objects/attribution-snapshot';
import { FunnelSnapshotRef, StepSlug } from '../domain/value-objects/funnel-snapshot-ref';
import { OfferLineItem } from '../domain/value-objects/offer-line-item';
import { PriceSnapshot } from '../domain/value-objects/price-snapshot';
import { ApplyCouponService } from './apply-coupon-service';

function sessionWithLine() {
  const s = FunnelSession.start({
    sessionId: 'sess_1', tenantId: 'default', snapshotRef: FunnelSnapshotRef.of('fn_1', 1),
    stepSlugs: [StepSlug.of('checkout')], attribution: AttributionSnapshot.empty('sess_1'), entryStep: StepSlug.of('checkout'),
  });
  s.addLine(OfferLineItem.create({
    variantExternalId: ExternalRef.of('gid://v/1'), title: 'x', quantity: 1,
    unitPrice: PriceSnapshot.create(Money.of(2000, 'USD'), new Date('2026-06-04T00:00:00Z')),
  }));
  return s;
}

describe('ApplyCouponService', () => {
  it('applies a 10% coupon to a $20 line yielding a $2.00 discount', async () => {
    const session = sessionWithLine();
    const deps = {
      sessions: { load: vi.fn(async () => session), store: vi.fn(async () => {}) },
      coupons: { findByCode: vi.fn(async () => ({ code: 'SAVE10', kind: 'percentage' as const, value: 10, minSubtotalMinor: 0 })) },
      ttlSeconds: 3600,
    };
    const svc = new ApplyCouponService(deps as any);
    const result = await svc.execute('sess_1', 'SAVE10');
    expect(result.discountMinor).toBe(200);
    expect(session.cart.coupon?.discount.amountMinor).toBe(200);
    expect(deps.sessions.store).toHaveBeenCalled();
  });

  it('rejects an unknown coupon code', async () => {
    const session = sessionWithLine();
    const deps = {
      sessions: { load: vi.fn(async () => session), store: vi.fn(async () => {}) },
      coupons: { findByCode: vi.fn(async () => null) },
      ttlSeconds: 3600,
    };
    const svc = new ApplyCouponService(deps as any);
    await expect(svc.execute('sess_1', 'NOPE')).rejects.toThrow(/Unknown coupon/);
  });
});
