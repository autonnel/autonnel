import { describe, it, expect, vi } from 'vitest';
import { FunnelSession } from '../domain/funnel-session';
import { AttributionSnapshot } from '../domain/value-objects/attribution-snapshot';
import { FunnelSnapshotRef, StepSlug } from '../domain/value-objects/funnel-snapshot-ref';
import { AddToCartService } from './add-to-cart-service';

function emptySession() {
  return FunnelSession.start({
    sessionId: 'sess_1', tenantId: 'default', snapshotRef: FunnelSnapshotRef.of('fn_1', 1),
    stepSlugs: [StepSlug.of('checkout')], attribution: AttributionSnapshot.empty('sess_1'), entryStep: StepSlug.of('checkout'),
  });
}

describe('AddToCartService', () => {
  it('resolves a sellable Purchasable and adds a priced line', async () => {
    const session = emptySession();
    const deps = {
      sessions: { load: vi.fn(async () => session), store: vi.fn(async () => {}) },
      catalog: { resolve: vi.fn(async () => [{ variantExternalId: 'gid://v/1', title: 'Widget', unitPriceMinor: 1500, currencyCode: 'USD', sellable: true }]) },
      clock: () => new Date('2026-06-04T00:00:00Z'),
      ttlSeconds: 3600,
      market: { countryCode: 'US', currencyCode: 'USD' },
    };
    const svc = new AddToCartService(deps as any);
    await svc.execute('sess_1', { variantExternalId: 'gid://v/1', quantity: 2 });
    expect(session.cart.lines).toHaveLength(1);
    expect(session.cart.lines[0].lineTotal().amountMinor).toBe(3000);
    expect(deps.sessions.store).toHaveBeenCalled();
  });

  it('rejects an unsellable variant', async () => {
    const session = emptySession();
    const deps = {
      sessions: { load: vi.fn(async () => session), store: vi.fn(async () => {}) },
      catalog: { resolve: vi.fn(async () => [{ variantExternalId: 'gid://v/1', title: 'X', unitPriceMinor: 0, currencyCode: 'USD', sellable: false }]) },
      clock: () => new Date(), ttlSeconds: 3600, market: { countryCode: 'US', currencyCode: 'USD' },
    };
    const svc = new AddToCartService(deps as any);
    await expect(svc.execute('sess_1', { variantExternalId: 'gid://v/1', quantity: 1 })).rejects.toThrow(/sellable/i);
  });
});
