import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// This test drives the real hand-off that `discoveryFor()` being a stub returning `[]` used to
// break silently: makeAcquisitionAds -> CompleteAdConnectionService -> the real
// MetaAccountDiscoveryAdapter -> the real PrismaConnectionRepository.save(). Nothing about
// discovery or persistence is mocked; only the network (global fetch) and the Prisma delegate are
// stubbed. If accountDiscoveryFor's listAccounts ever regresses back to returning an empty array
// (the exact failure mode this task fixed), this test fails: persist() throws
// NoAdAccountsDiscoveredError instead of reaching the upsert assertion below.

const store = new Map<string, string>();
vi.mock('@/lib/config/get-config', () => ({
  getConfig: vi.fn(async (key: string) => store.get(key)),
  setConfig: vi.fn(async (key: string, value: string) => void store.set(key, value)),
  deleteConfig: vi.fn(async (key: string) => void store.delete(key)),
}));

import { makeAcquisitionAds, type AdsDeps } from './make-acquisition-ads';

function makeDeps(overrides: Partial<AdsDeps> = {}): { deps: AdsDeps; upsertCalls: any[] } {
  const upsertCalls: any[] = [];
  const deps: AdsDeps = {
    prisma: {
      adAccountConnection: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        upsert: vi.fn(async (args: any) => { upsertCalls.push(args); return args.create; }),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      adConversionDestination: { upsert: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({})) },
      postback: {},
      eventMappingProfile: {},
      adAttributionTouch: {},
      funnelAdConnection: {},
      adCreative: {},
      adDailyMetric: {},
      adSyncRun: {},
      page: { findMany: vi.fn(async () => []) },
      funnel: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
    },
    config: { getConfig: vi.fn(async () => undefined) },
    jobQueue: { enqueue: vi.fn(async () => {}) },
    events: { publish: vi.fn(async () => {}) },
    newId: () => `conn-${Math.random().toString(36).slice(2)}`,
    decodeState: vi.fn(async () => ({ platform: 'META', externalAccountId: '' })),
    encodeState: vi.fn(async () => 'state'),
    clientIdFor: vi.fn(async () => ''),
    ...overrides,
  };
  return { deps, upsertCalls };
}

describe('makeAcquisitionAds -> CompleteAdConnectionService -> real discovery adapter (seam test)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    store.clear();
    store.set('ads.facebook.app_id', 'seam-client-id');
    store.set('ads.facebook.app_secret', 'seam-client-secret');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('persists a connection under the real externalAccountId returned by a fetch-mocked Meta adaccounts response', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/oauth/access_token')) {
        return new Response(
          JSON.stringify({ access_token: 'seam-access-token', refresh_token: 'seam-refresh-token', expires_in: 5_184_000 }),
          { status: 200 },
        );
      }
      if (url.includes('/me/adaccounts')) {
        return new Response(
          JSON.stringify({
            data: [{ account_id: '999888777', name: 'Seam Test Ad Account', currency: 'USD', timezone_name: 'UTC' }],
            paging: {},
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch in seam test: ${url}`);
    }) as unknown as typeof fetch;

    const { deps, upsertCalls } = makeDeps();
    const ads = await makeAcquisitionAds(deps);

    const result = await ads.completeConnection.complete({ state: 's', code: 'c', redirectUri: 'https://x.test/cb' });

    // The bar this test exists to enforce: had accountDiscoveryFor's listAccounts still returned
    // an empty array (the old discoveryFor() stub's behavior), persist() would have thrown
    // NoAdAccountsDiscoveredError and neither of these assertions would ever run.
    expect(result.connectionIds).toHaveLength(1);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].create.externalAccountId).toBe('act_999888777');
    expect(upsertCalls[0].create.platform).toBe('META');
  });

  it('propagates the honest failure end to end when the real adapter discovers zero accounts', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'seam-access-token', expires_in: 5_184_000 }), { status: 200 });
      }
      if (url.includes('/me/adaccounts')) {
        return new Response(JSON.stringify({ data: [], paging: {} }), { status: 200 });
      }
      throw new Error(`unexpected fetch in seam test: ${url}`);
    }) as unknown as typeof fetch;

    const { deps, upsertCalls } = makeDeps();
    const ads = await makeAcquisitionAds(deps);

    await expect(
      ads.completeConnection.complete({ state: 's', code: 'c', redirectUri: 'https://x.test/cb' }),
    ).rejects.toThrow(/No ad accounts were discovered/);
    expect(upsertCalls).toHaveLength(0);
  });
});
