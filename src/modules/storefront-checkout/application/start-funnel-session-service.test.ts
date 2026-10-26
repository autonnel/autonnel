import { describe, it, expect, vi } from 'vitest';
import { StartFunnelSessionService } from './start-funnel-session-service';

function stubResolveMarket(currency: string | null) {
  if (!currency) return { countryCode: 'US', currencyCode: 'USD' };
  if (currency === 'EUR') return { countryCode: 'DE', currencyCode: 'EUR' };
  throw new Error(`Unsupported checkout currency: ${currency}`);
}

describe('StartFunnelSessionService', () => {
  it('pins the snapshot (funnelId, version) and stores with the configured TTL', async () => {
    const stored: { ttl: number }[] = [];
    const deps = {
      snapshots: {
        loadByStepSlug: vi.fn(async () => ({
          funnelId: 'fn_1', version: 3, stepSlugs: ['landing', 'checkout'],
          pageHtmlByStep: {}, pageCurrencyByStep: {}, entryStep: 'checkout',
        })),
        loadPinned: vi.fn(),
      },
      attribution: { read: vi.fn(async () => null) },
      sessions: { store: vi.fn(async (_s: any, ttl: number) => { stored.push({ ttl }); }), load: vi.fn() },
      newSessionId: () => 'sess_new',
      ttlSeconds: 1800,
      tenantId: 'default',
      resolveMarket: () => ({ countryCode: 'US', currencyCode: 'USD' }),
    };
    const svc = new StartFunnelSessionService(deps as any);
    const session = await svc.execute('checkout');

    expect(session.sessionId).toBe('sess_new');
    expect(session.snapshotRef.funnelId).toBe('fn_1');
    expect(session.snapshotRef.version).toBe(3);
    expect(session.currentStep.value).toBe('checkout');
    expect(stored).toEqual([{ ttl: 1800 }]);
  });

  it('freezes the attribution snapshot when the reader returns one', async () => {
    const deps = {
      snapshots: {
        loadByStepSlug: vi.fn(async () => ({
          funnelId: 'fn_1', version: 1, stepSlugs: ['checkout'],
          pageHtmlByStep: {}, pageCurrencyByStep: {}, entryStep: 'checkout',
        })),
        loadPinned: vi.fn(),
      },
      attribution: { read: vi.fn(async () => ({ landingUrl: 'https://x/lp?gclid=abc', clickIds: { gclid: 'abc' }, utm: {} })) },
      sessions: { store: vi.fn(async () => {}), load: vi.fn() },
      newSessionId: () => 'sess_new',
      ttlSeconds: 1800,
      tenantId: 'default',
      resolveMarket: () => ({ countryCode: 'US', currencyCode: 'USD' }),
    };
    const svc = new StartFunnelSessionService(deps as any);
    const session = await svc.execute('checkout');
    expect(session.attribution.sessionId).toBe('sess_new');
    expect(session.attribution.toJSON().clickIds.gclid).toBe('abc');
  });

  function depsWithPageCurrency(pageCurrencyByStep: Record<string, string>) {
    return {
      snapshots: {
        loadByStepSlug: vi.fn(async () => ({
          funnelId: 'fn_1', version: 1, stepSlugs: ['checkout'],
          pageHtmlByStep: {}, pageCurrencyByStep, entryStep: 'checkout',
        })),
        loadPinned: vi.fn(),
      },
      attribution: { read: vi.fn(async () => null) },
      sessions: { store: vi.fn(async () => {}), load: vi.fn() },
      newSessionId: () => 'sess_new',
      ttlSeconds: 1800,
      tenantId: 'default',
      resolveMarket: stubResolveMarket,
    };
  }

  it('start uses entry page currency', async () => {
    const session = await new StartFunnelSessionService(depsWithPageCurrency({ checkout: 'EUR' }) as any).execute('checkout');
    expect(session.market).toEqual({ countryCode: 'DE', currencyCode: 'EUR' });
  });

  it('start with empty page currency uses default', async () => {
    const session = await new StartFunnelSessionService(depsWithPageCurrency({ checkout: '' }) as any).execute('checkout');
    expect(session.market).toEqual({ countryCode: 'US', currencyCode: 'USD' });
  });

  it('fails the session start for an unsupported page currency', async () => {
    const deps = depsWithPageCurrency({ checkout: 'XYZ' });
    await expect(new StartFunnelSessionService(deps as any).execute('checkout')).rejects.toThrow(/Unsupported checkout currency/);
    expect(deps.sessions.store).not.toHaveBeenCalled();
  });

  it('throws when no published funnel exists for the step', async () => {
    const deps = {
      snapshots: { loadByStepSlug: vi.fn(async () => null), loadPinned: vi.fn() },
      attribution: { read: vi.fn() },
      sessions: { store: vi.fn(), load: vi.fn() },
      newSessionId: () => 'sess_new',
      ttlSeconds: 1800,
      tenantId: 'default',
      resolveMarket: () => ({ countryCode: 'US', currencyCode: 'USD' }),
    };
    const svc = new StartFunnelSessionService(deps as any);
    await expect(svc.execute('checkout')).rejects.toThrow(/No published funnel/);
  });
});
