import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, string>();
vi.mock('@/lib/config/get-config', () => ({
  getConfig: vi.fn(async (key: string) => store.get(key)),
  setConfig: vi.fn(async (key: string, value: string) => void store.set(key, value)),
  deleteConfig: vi.fn(async (key: string) => void store.delete(key)),
}));

const tiktok = vi.hoisted(() => ({
  constructedWith: [] as Array<string | null>,
  resolvedCurrency: null as string | null,
  fetchAdInsights: vi.fn(async () => ({ rows: [], truncated: false })),
  fetchAccountTimezone: vi.fn(async () => null),
}));

vi.mock('@/modules/acquisition-ads/infra/platforms/tiktok/insights.adapter', () => ({
  // Real TikTokInsightsAdapter behavior (lazy resolution, throw-if-unresolvable) is already
  // covered by tiktok/insights.adapter.test.ts; this mock isolates composition's OWN
  // responsibility -- which currency it passes to the constructor, and whether it persists a
  // lazily-resolved one -- from TikTok's HTTP calls.
  TikTokInsightsAdapter: vi.fn().mockImplementation(function (this: any, _fetchImpl: unknown, currency: string | null) {
    tiktok.constructedWith.push(currency);
    this.platform = 'TIKTOK';
    this.fetchAdInsights = tiktok.fetchAdInsights;
    this.fetchAccountTimezone = tiktok.fetchAccountTimezone;
    Object.defineProperty(this, 'resolvedCurrency', { get: () => tiktok.resolvedCurrency });
  }),
}));

import { makeAcquisitionAds, type AdsDeps } from './make-acquisition-ads';
import { WorkersTokenCipher } from '@/modules/acquisition-ads/infra/crypto/workers-token-cipher';

function makeFakeDeps(overrides: Partial<AdsDeps> = {}): AdsDeps {
  const base: AdsDeps = {
    prisma: {
      adAccountConnection: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        upsert: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
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
    // Always undefined regardless of the key: makes the token cipher key deterministically the
    // all-zero fallback, independent of any ADS_TOKEN_CIPHER_KEY set in the real environment.
    config: { getConfig: vi.fn(async () => undefined) },
    jobQueue: { enqueue: vi.fn(async () => {}) },
    events: { publish: vi.fn(async () => {}) },
    newId: () => `id-${Math.random().toString(36).slice(2)}`,
    decodeState: vi.fn(async () => ({ platform: 'META', externalAccountId: '' })),
    encodeState: vi.fn(async () => 'state'),
    clientIdFor: vi.fn(async () => ''),
  };
  return { ...base, ...overrides, prisma: { ...base.prisma, ...(overrides.prisma ?? {}) } };
}

beforeEach(() => {
  store.clear();
  tiktok.constructedWith.length = 0;
  tiktok.resolvedCurrency = null;
  tiktok.fetchAdInsights.mockClear();
});

describe('makeAcquisitionAds oauthFor', () => {
  it('returns the Meta adapter, constructed with Meta credentials, for META and FACEBOOK', async () => {
    store.set('ads.facebook.app_id', 'meta-cid');
    store.set('ads.facebook.app_secret', 'meta-secret');
    const ads = await makeAcquisitionAds(makeFakeDeps());

    for (const platform of ['META', 'FACEBOOK']) {
      const adapter = ads.oauthFor(platform) as any;
      expect(adapter.capability().platform).toBe('META');
      expect(adapter.creds).toEqual({ clientId: 'meta-cid', clientSecret: 'meta-secret' });
    }
  });

  it('returns the Google adapter, constructed with Google credentials, for GOOGLE and GOOGLE_ADS', async () => {
    store.set('ads.google_ads.client_id', 'g-cid');
    store.set('ads.google_ads.client_secret', 'g-secret');
    const ads = await makeAcquisitionAds(makeFakeDeps());

    for (const platform of ['GOOGLE', 'GOOGLE_ADS']) {
      const adapter = ads.oauthFor(platform) as any;
      expect(adapter.capability().platform).toBe('GOOGLE');
      expect(adapter.creds).toEqual({ clientId: 'g-cid', clientSecret: 'g-secret' });
    }
  });

  it('returns the TikTok adapter, constructed with TikTok credentials, for TIKTOK', async () => {
    store.set('ads.tiktok.app_id', 't-cid');
    store.set('ads.tiktok.app_secret', 't-secret');
    const ads = await makeAcquisitionAds(makeFakeDeps());

    const adapter = ads.oauthFor('TIKTOK') as any;
    expect(adapter.capability().platform).toBe('TIKTOK');
    expect(adapter.creds).toEqual({ clientId: 't-cid', clientSecret: 't-secret' });
  });

  it('never lets one platform read another platform credentials', async () => {
    store.set('ads.facebook.app_id', 'meta-cid');
    store.set('ads.facebook.app_secret', 'meta-secret');
    store.set('ads.tiktok.app_id', 't-cid');
    store.set('ads.tiktok.app_secret', 't-secret');
    const ads = await makeAcquisitionAds(makeFakeDeps());

    expect((ads.oauthFor('META') as any).creds.clientId).toBe('meta-cid');
    expect((ads.oauthFor('TIKTOK') as any).creds.clientId).toBe('t-cid');
  });
});

describe('makeAcquisitionAds accountDiscoveryFor', () => {
  it('binds the GOOGLE developer token from the same apps map oauthFor reads', async () => {
    store.set('ads.google_ads.client_id', 'g-cid');
    store.set('ads.google_ads.client_secret', 'g-secret');
    store.set('ads.google_ads.developer_token', 'dev-token');
    const ads = await makeAcquisitionAds(makeFakeDeps());

    const adapter = ads.accountDiscoveryFor('GOOGLE') as any;
    expect(adapter.platform).toBe('GOOGLE');
    expect(adapter.developerToken).toBe('dev-token');
  });

  it('binds the TikTok app id/secret for TIKTOK', async () => {
    store.set('ads.tiktok.app_id', 't-cid');
    store.set('ads.tiktok.app_secret', 't-secret');
    const ads = await makeAcquisitionAds(makeFakeDeps());

    const adapter = ads.accountDiscoveryFor('TIKTOK') as any;
    expect(adapter.app).toEqual({ clientId: 't-cid', clientSecret: 't-secret' });
  });

  it('returns the META adapter for META and FACEBOOK', async () => {
    const ads = await makeAcquisitionAds(makeFakeDeps());
    expect(ads.accountDiscoveryFor('META').platform).toBe('META');
    expect(ads.accountDiscoveryFor('FACEBOOK').platform).toBe('META');
  });
});

describe('makeAcquisitionAds insightsFor', () => {
  it('returns null for BING_ADS, which has no insights adapter', async () => {
    const ads = await makeAcquisitionAds(makeFakeDeps());
    expect(ads.insightsFor('BING_ADS')).toBeNull();
  });

  it('returns a working port for META, GOOGLE and TIKTOK', async () => {
    const ads = await makeAcquisitionAds(makeFakeDeps());
    expect(ads.insightsFor('META')?.platform).toBe('META');
    expect(ads.insightsFor('GOOGLE')?.platform).toBe('GOOGLE');
    expect(ads.insightsFor('TIKTOK')?.platform).toBe('TIKTOK');
  });
});

describe('makeAcquisitionAds accessTokenFor', () => {
  it('decrypts the stored access token rather than returning ciphertext', async () => {
    const cipher = await WorkersTokenCipher.fromRawKey(new Uint8Array(32));
    const sealedAccess = await cipher.seal('plain-access-token', 1);
    const sealedRefresh = await cipher.seal('plain-refresh-token', 1);

    const deps = makeFakeDeps();
    (deps.prisma.adAccountConnection.findFirst as any) = vi.fn(async () => ({
      id: 'conn-1',
      platform: 'META',
      externalAccountId: 'acct-1',
      status: 'ACTIVE',
      accessToken: sealedAccess.toJSON(),
      refreshToken: sealedRefresh.toJSON(),
      accessTokenExpiresAt: new Date(),
      grantedScopes: [],
      requiredScopes: [],
      destinations: [],
    }));

    const ads = await makeAcquisitionAds(deps);
    const creds = await ads.accessTokenFor('conn-1');

    expect(creds.accessToken).toBe('plain-access-token');
    expect(creds.accessToken).not.toBe(sealedAccess.ciphertext);
    expect(creds.developerToken).toBeUndefined();
  });

  it('includes the developer token for a GOOGLE connection', async () => {
    store.set('ads.google_ads.client_id', 'g-cid');
    store.set('ads.google_ads.client_secret', 'g-secret');
    store.set('ads.google_ads.developer_token', 'dev-token');

    const cipher = await WorkersTokenCipher.fromRawKey(new Uint8Array(32));
    const sealedAccess = await cipher.seal('google-access-token', 1);
    const sealedRefresh = await cipher.seal('google-refresh-token', 1);

    const deps = makeFakeDeps();
    (deps.prisma.adAccountConnection.findFirst as any) = vi.fn(async () => ({
      id: 'conn-g',
      platform: 'GOOGLE',
      externalAccountId: 'acct-g',
      status: 'ACTIVE',
      accessToken: sealedAccess.toJSON(),
      refreshToken: sealedRefresh.toJSON(),
      accessTokenExpiresAt: new Date(),
      grantedScopes: [],
      requiredScopes: [],
      destinations: [],
    }));

    const ads = await makeAcquisitionAds(deps);
    const creds = await ads.accessTokenFor('conn-g');

    expect(creds.accessToken).toBe('google-access-token');
    expect(creds.developerToken).toBe('dev-token');
  });
});

describe('makeAcquisitionAds TikTok currency wiring', () => {
  it('passes the connection reportingCurrency through to the TikTok adapter constructor', async () => {
    const deps = makeFakeDeps();
    (deps.prisma.adAccountConnection.findMany as any) = vi.fn(async () => [
      { id: 'conn-tt', platform: 'TIKTOK', externalAccountId: 'acct-eur', reportingTimezone: null, reportingCurrency: 'EUR' },
    ]);

    const ads = await makeAcquisitionAds(deps);
    // listConnections primes the cache; the (unmodified) sync service always calls it before
    // insightsFor, so this mirrors the real call order.
    await ads.listConnections();

    const port = ads.insightsFor('TIKTOK')!;
    await port.fetchAdInsights({ accessToken: 't', externalAccountId: 'acct-eur', start: '2026-01-01', end: '2026-01-01' });

    expect(tiktok.constructedWith).toEqual(['EUR']);
    // Already cached: no reason to write it back.
    expect(deps.prisma.adAccountConnection.updateMany).not.toHaveBeenCalled();
  });

  it('persists a lazily-resolved currency exactly once', async () => {
    tiktok.resolvedCurrency = 'GBP';
    const deps = makeFakeDeps();

    const ads = await makeAcquisitionAds(deps);
    const port = ads.insightsFor('TIKTOK')!;
    const input = { accessToken: 't', externalAccountId: 'acct-new', start: '2026-01-01', end: '2026-01-01' };

    await port.fetchAdInsights(input);
    await port.fetchAdInsights(input);

    // First call constructs with null (nothing cached yet) and resolves lazily; the second call
    // reads the now-primed in-memory cache, so it is constructed with the resolved currency
    // directly instead of resolving again.
    expect(tiktok.constructedWith).toEqual([null, 'GBP']);
    // Persisted only once, since the second call found the cache already primed by the first.
    expect(deps.prisma.adAccountConnection.updateMany).toHaveBeenCalledTimes(1);
    expect(deps.prisma.adAccountConnection.updateMany).toHaveBeenCalledWith({
      where: { platform: 'TIKTOK', externalAccountId: 'acct-new' },
      data: { reportingCurrency: 'GBP' },
    });
  });
});
