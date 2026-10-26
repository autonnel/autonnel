import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  requireFeature: vi.fn(),
  getPrincipal: vi.fn((): Record<string, unknown> | null => ({ kind: 'user', userId: 'user-1', tenantId: 'tenant-1' })),
  getAdsOAuthApp: vi.fn(),
  getRelayBaseUrl: vi.fn(async (): Promise<string | null> => 'https://relay.example'),
  issueOAuthState: vi.fn(async () => 'signed-state-token'),
  getCurrentTenantId: vi.fn(() => 'tenant-1'),
  start: vi.fn(async () => ({ authorizeUrl: 'https://provider.example/authorize?x=1', state: 's' })),
  makeAcquisitionAds: vi.fn(async () => ({ startConnection: { start: h.start } })),
}));

vi.mock('@/modules/identity/published/principal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/identity/published/principal')>();
  return { ...actual, requireFeature: h.requireFeature, getPrincipal: h.getPrincipal };
});
vi.mock('@/lib/config/ads-apps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config/ads-apps')>();
  // canonicalAdsPlatform/relayEnabledFor/RELAY_PLATFORMS must stay real: the allowlist and relay
  // routing checks depend on the real mapping. getRelayBaseUrl is stubbed to avoid a real KV/DB
  // round-trip (it otherwise calls through getConfig -> tenant-scoped prisma).
  return { ...actual, getAdsOAuthApp: h.getAdsOAuthApp, getRelayBaseUrl: h.getRelayBaseUrl };
});
vi.mock('@/lib/auth/oauth-state', () => ({ issueOAuthState: h.issueOAuthState }));
vi.mock('@/lib/tenant/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tenant/context')>();
  return { ...actual, getCurrentTenantId: h.getCurrentTenantId };
});
vi.mock('@/composition/make-acquisition-ads', () => ({ makeAcquisitionAds: h.makeAcquisitionAds }));
vi.mock('@/composition/make-ads-deps', () => ({ createAdsDepsForRequest: vi.fn(async () => ({})) }));

const { requireFeature, getPrincipal, getAdsOAuthApp, getRelayBaseUrl, issueOAuthState, makeAcquisitionAds, start } = h;

import { ForbiddenError } from '@/modules/identity/published/principal';
import { GET } from './authorize';

function ctx(platform: string, query: Record<string, string> = {}): any {
  const url = new URL(`https://x.test/api/ads/oauth/${platform}/authorize`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return {
    params: { platform },
    request: new Request(url),
    url,
    locals: {},
  };
}

beforeEach(() => {
  requireFeature.mockClear();
  getPrincipal.mockClear();
  getPrincipal.mockReturnValue({ kind: 'user', userId: 'user-1', tenantId: 'tenant-1' });
  getAdsOAuthApp.mockClear();
  getRelayBaseUrl.mockClear();
  getRelayBaseUrl.mockResolvedValue('https://relay.example');
  issueOAuthState.mockClear();
  makeAcquisitionAds.mockClear();
  start.mockClear();
});

describe('GET /api/ads/oauth/[platform]/authorize', () => {
  it('requires the SETTINGS_ADS feature', async () => {
    getAdsOAuthApp.mockResolvedValue({ clientId: 'id', clientSecret: 'secret' });
    await GET(ctx('META'));
    expect(requireFeature).toHaveBeenCalledWith('SETTINGS_ADS');
  });

  it('returns a clean 401, not a 500, for an unauthenticated request', async () => {
    getPrincipal.mockReturnValue(null);
    requireFeature.mockImplementationOnce(() => { throw new ForbiddenError('SETTINGS_ADS' as never); });
    const res = await GET(ctx('META'));

    expect(res.status).toBe(401);
    expect(getAdsOAuthApp).not.toHaveBeenCalled();
  });

  it('returns a clean 403, not a 500, when the principal lacks the feature', async () => {
    requireFeature.mockImplementationOnce(() => { throw new ForbiddenError('SETTINGS_ADS' as never); });
    const res = await GET(ctx('META'));

    expect(res.status).toBe(403);
    expect(getAdsOAuthApp).not.toHaveBeenCalled();
  });

  it('rejects BING_ADS with a 4xx naming the platform, before calling getAdsOAuthApp or building any service', async () => {
    const res = await GET(ctx('BING_ADS'));

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    const body = await res.text();
    expect(body).toContain('BING_ADS');
    expect(body.toLowerCase()).toContain('token-mode');
    expect(getAdsOAuthApp).not.toHaveBeenCalled();
    expect(makeAcquisitionAds).not.toHaveBeenCalled();
  });

  it('rejects the BING alias the same way as BING_ADS', async () => {
    const res = await GET(ctx('BING'));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('returns 412 when the platform app is not configured, leaking no credential material', async () => {
    getAdsOAuthApp.mockResolvedValue(null);
    const res = await GET(ctx('META'));

    expect(res.status).toBe(412);
    const body = await res.text();
    expect(body).not.toMatch(/client[_-]?id|secret|token/i);
    expect(makeAcquisitionAds).not.toHaveBeenCalled();
  });

  it('redirects to the provider authorize url once the app is configured', async () => {
    getAdsOAuthApp.mockResolvedValue({ clientId: 'id', clientSecret: 'secret' });
    const res = await GET(ctx('META'));

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://provider.example/authorize?x=1');
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'META', redirectUri: 'https://x.test/api/ads/oauth/META/callback' }),
    );
  });

  it('allows the FACEBOOK and GOOGLE_ADS aliases through the allowlist', async () => {
    getAdsOAuthApp.mockResolvedValue({ clientId: 'id', clientSecret: 'secret' });
    for (const platform of ['FACEBOOK', 'GOOGLE_ADS', 'TIKTOK']) {
      const res = await GET(ctx(platform));
      expect(res.status).toBe(302);
    }
  });

  describe('?mode=relay', () => {
    it('refuses a relay-disabled platform (TIKTOK) with a clear 412, never starting a flow', async () => {
      const res = await GET(ctx('TIKTOK', { mode: 'relay' }));

      expect(res.status).toBe(412);
      const body = await res.text();
      expect(body).toContain('TIKTOK');
      expect(issueOAuthState).not.toHaveBeenCalled();
    });

    it('refuses BING_ADS in relay mode too, via the same allowlist as byo mode', async () => {
      const res = await GET(ctx('BING_ADS', { mode: 'relay' }));
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(issueOAuthState).not.toHaveBeenCalled();
    });

    it('returns 412 and issues no state when the hosted relay is not configured', async () => {
      getRelayBaseUrl.mockResolvedValue(null);
      const res = await GET(ctx('META', { mode: 'relay' }));

      expect(res.status).toBe(412);
      expect(issueOAuthState).not.toHaveBeenCalled();
    });

    it('requires an interactive user principal, not an API client', async () => {
      getPrincipal.mockReturnValue({ kind: 'apiClient', apiKeyId: 'k1', tenantId: 't1', permissions: {}, writeAccess: true });
      const res = await GET(ctx('META', { mode: 'relay' }));
      expect(res.status).toBe(401);
      expect(issueOAuthState).not.toHaveBeenCalled();
    });

    it('redirects to the relay with a state-bearing callback_url, never calling getAdsOAuthApp', async () => {
      const res = await GET(ctx('META', { mode: 'relay' }));

      expect(res.status).toBe(302);
      expect(issueOAuthState).toHaveBeenCalledWith({ platform: 'META', tenantId: 'tenant-1', userId: 'user-1' });
      expect(getAdsOAuthApp).not.toHaveBeenCalled();

      const location = new URL(res.headers.get('location')!);
      expect(location.origin).toBe('https://relay.example');
      expect(location.pathname).toBe('/api/auth/facebook');
      const callbackUrl = new URL(location.searchParams.get('callback_url')!);
      expect(callbackUrl.pathname).toBe('/api/ads/oauth/relay/callback');
      expect(callbackUrl.searchParams.get('state')).toBe('signed-state-token');
    });
  });
});
