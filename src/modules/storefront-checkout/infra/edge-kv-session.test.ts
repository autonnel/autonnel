import { describe, it, expect } from 'vitest';
import { Money } from '@/modules/shared-kernel/money';
import { ExternalRef } from '@/modules/shared-kernel/external-ref';
import { FunnelSession } from '../domain/funnel-session';
import { AttributionSnapshot } from '../domain/value-objects/attribution-snapshot';
import { FunnelSnapshotRef, StepSlug } from '../domain/value-objects/funnel-snapshot-ref';
import { OfferLineItem } from '../domain/value-objects/offer-line-item';
import { PriceSnapshot } from '../domain/value-objects/price-snapshot';
import { AppliedCoupon } from '../domain/value-objects/applied-coupon';
import { EdgeKvSessionAdapter } from './edge-kv-session';

class FakeKv {
  store = new Map<string, string>();
  ttls = new Map<string, number>();
  async get(key: string) { return this.store.get(key) ?? null; }
  async put(key: string, value: string, opts?: { expirationTtl?: number }) {
    this.store.set(key, value);
    if (opts?.expirationTtl) this.ttls.set(key, opts.expirationTtl);
  }
  async delete(key: string) { this.store.delete(key); }
}

function session() {
  return FunnelSession.start({
    sessionId: 'sess_1', tenantId: 'default', snapshotRef: FunnelSnapshotRef.of('fn_1', 1),
    stepSlugs: [StepSlug.of('checkout')], attribution: AttributionSnapshot.empty('sess_1'), entryStep: StepSlug.of('checkout'),
  });
}

describe('EdgeKvSessionAdapter', () => {
  it('stores under a tenant-prefixed key with a TTL and reloads an equivalent session', async () => {
    const kv = new FakeKv();
    const adapter = new EdgeKvSessionAdapter({ kv: kv as any, tenantId: 'default', cookieSecret: 's3cr3t' });
    const s = session();
    await adapter.store(s, 3600);
    expect([...kv.store.keys()][0]).toBe('session:default:sess_1');
    expect(kv.ttls.get('session:default:sess_1')).toBe(3600);
    const loaded = await adapter.load('sess_1');
    expect(loaded?.sessionId).toBe('sess_1');
    expect(loaded?.currentStep.value).toBe('checkout');
    expect(loaded?.snapshotRef.equals(FunnelSnapshotRef.of('fn_1', 1))).toBe(true);
  });

  it('round-trips a signed cookie value', async () => {
    const kv = new FakeKv();
    const adapter = new EdgeKvSessionAdapter({ kv: kv as any, tenantId: 'default', cookieSecret: 's3cr3t' });
    const cookie = await adapter.signCookieValue('sess_1');
    expect(await adapter.verifyCookieValue(cookie)).toBe('sess_1');
    expect(await adapter.verifyCookieValue('sess_1.bad')).toBeNull();
  });

  it('round-trips the cart lines and coupon through KV', async () => {
    const kv = new FakeKv();
    const adapter = new EdgeKvSessionAdapter({ kv: kv as any, tenantId: 'default', cookieSecret: 's3cr3t' });
    const s = session();
    s.addLine(OfferLineItem.create({
      variantExternalId: ExternalRef.of('gid://v/1'),
      title: 'Widget',
      quantity: 2,
      unitPrice: PriceSnapshot.create(Money.of(1000, 'USD'), new Date('2026-06-04T00:00:00Z')),
    }));
    s.applyCoupon(AppliedCoupon.create('SAVE10', 'percentage', Money.of(100, 'USD')));
    await adapter.store(s, 3600);

    const loaded = await adapter.load('sess_1');
    expect(loaded?.cart.lines).toHaveLength(1);
    expect(loaded?.cart.lines[0].variantExternalId.toString()).toBe('gid://v/1');
    expect(loaded?.cart.lines[0].title).toBe('Widget');
    expect(loaded?.cart.lines[0].quantity).toBe(2);
    expect(loaded?.cart.lines[0].unitPrice.amount.amountMinor).toBe(1000);
    expect(loaded?.cart.coupon?.code).toBe('SAVE10');
    expect(loaded?.cart.coupon?.kind).toBe('percentage');
    expect(loaded?.cart.coupon?.discount.amountMinor).toBe(100);
  });
});
