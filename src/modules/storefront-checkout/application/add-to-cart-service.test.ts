import { describe, it, expect, vi } from 'vitest';
import { FunnelSession } from '../domain/funnel-session';
import { AttributionSnapshot } from '../domain/value-objects/attribution-snapshot';
import { FunnelSnapshotRef, StepSlug } from '../domain/value-objects/funnel-snapshot-ref';
import { AddToCartService } from './add-to-cart-service';

function emptySession(market = { countryCode: 'US', currencyCode: 'USD' }) {
  return FunnelSession.start({
    sessionId: 'sess_1', tenantId: 'default', snapshotRef: FunnelSnapshotRef.of('fn_1', 1),
    stepSlugs: [StepSlug.of('checkout')], attribution: AttributionSnapshot.empty('sess_1'), entryStep: StepSlug.of('checkout'),
    market,
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
      clock: () => new Date(), ttlSeconds: 3600,
    };
    const svc = new AddToCartService(deps as any);
    await expect(svc.execute('sess_1', { variantExternalId: 'gid://v/1', quantity: 1 })).rejects.toThrow(/sellable/i);
  });

  it('replace starts the cart over so a changed selection does not accumulate lines', async () => {
    const session = emptySession();
    const resolve = vi.fn(async (ids: string[]) => [{ variantExternalId: ids[0], title: ids[0], unitPriceMinor: 1000, currencyCode: 'USD', sellable: true }]);
    const deps = {
      sessions: { load: vi.fn(async () => session), store: vi.fn(async () => {}) },
      catalog: { resolve },
      clock: () => new Date(), ttlSeconds: 3600,
    };
    const svc = new AddToCartService(deps as any);
    await svc.execute('sess_1', { variantExternalId: 'a', quantity: 1, replace: true });
    await svc.execute('sess_1', { variantExternalId: 'b', quantity: 1, replace: true });
    await svc.execute('sess_1', { variantExternalId: 'c', quantity: 1 });
    expect(session.cart.lines.map((l) => l.variantExternalId.toString())).toEqual(['b', 'c']);
  });

  it('replace persists the cleared cart even when the new line is rejected', async () => {
    const session = emptySession();
    const deps = {
      sessions: { load: vi.fn(async () => session), store: vi.fn(async () => {}) },
      catalog: { resolve: vi.fn(async () => [{ variantExternalId: 'x', title: 'X', unitPriceMinor: 1000, currencyCode: 'USD', sellable: true }]) },
      clock: () => new Date(), ttlSeconds: 3600,
    };
    const svc = new AddToCartService(deps as any);
    await svc.execute('sess_1', { variantExternalId: 'x', quantity: 1 });
    deps.catalog.resolve.mockResolvedValueOnce([{ variantExternalId: 'y', title: 'Y', unitPriceMinor: 0, currencyCode: 'USD', sellable: false }]);
    deps.sessions.store.mockClear();
    await expect(svc.execute('sess_1', { variantExternalId: 'y', quantity: 1, replace: true })).rejects.toThrow(/sellable/i);
    expect(session.cart.lines).toHaveLength(0);
    expect(deps.sessions.store).toHaveBeenCalledTimes(1);
  });

  it('add to cart prices in session market', async () => {
    const session = emptySession({ countryCode: 'DE', currencyCode: 'EUR' });
    const resolve = vi.fn(async (ids: string[], market: { countryCode: string; currencyCode: string }) => [
      { variantExternalId: ids[0], title: 'Widget', unitPriceMinor: 1400, currencyCode: market.currencyCode, sellable: true },
    ]);
    const deps = {
      sessions: { load: vi.fn(async () => session), store: vi.fn(async () => {}) },
      catalog: { resolve },
      clock: () => new Date(), ttlSeconds: 3600,
    };
    await new AddToCartService(deps as any).execute('sess_1', { variantExternalId: 'gid://v/1', quantity: 1 });
    expect(resolve).toHaveBeenCalledWith(['gid://v/1'], { countryCode: 'DE', currencyCode: 'EUR' });
    expect(session.cart.lines[0].unitPrice.amount.currencyCode).toBe('EUR');
  });
});
