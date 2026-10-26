import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuthStateError } from '@/lib/auth/oauth-state';
import { NoAdAccountsDiscoveredError } from '@/modules/acquisition-ads/domain/errors';

const h = vi.hoisted(() => ({
  requireFeature: vi.fn(),
  getPrincipal: vi.fn((): Record<string, unknown> | null => ({ kind: 'user', userId: 'user-1', tenantId: 'tenant-1' })),
  complete: vi.fn(async () => ({ connectionIds: ['conn-1', 'conn-2'] })),
  makeAcquisitionAds: vi.fn(async () => ({ completeConnection: { complete: h.complete } })),
  triggerFirstConnectBackfill: vi.fn(),
}));

vi.mock('@/modules/identity/published/principal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/identity/published/principal')>();
  return { ...actual, requireFeature: h.requireFeature, getPrincipal: h.getPrincipal };
});
vi.mock('@/composition/make-acquisition-ads', () => ({ makeAcquisitionAds: h.makeAcquisitionAds }));
vi.mock('@/composition/make-ads-deps', () => ({ createAdsDepsForRequest: vi.fn(async () => ({})) }));
vi.mock('@/composition/trigger-ad-insights-backfill', () => ({
  triggerFirstConnectBackfill: h.triggerFirstConnectBackfill,
}));

import { ForbiddenError } from '@/modules/identity/published/principal';
import { GET } from './callback';

function ctx(platform: string, query: Record<string, string>): any {
  const url = new URL(`https://x.test/api/ads/oauth/${platform}/callback`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return {
    params: { platform },
    request: new Request(url),
    url,
    locals: {},
  };
}

beforeEach(() => {
  h.requireFeature.mockClear();
  h.getPrincipal.mockClear();
  h.getPrincipal.mockReturnValue({ kind: 'user', userId: 'user-1', tenantId: 'tenant-1' });
  h.complete.mockClear();
  h.makeAcquisitionAds.mockClear();
  h.triggerFirstConnectBackfill.mockClear();
});

describe('GET /api/ads/oauth/[platform]/callback', () => {
  it('requires the SETTINGS_ADS feature', async () => {
    await GET(ctx('META', { code: 'c', state: 's' }));
    expect(h.requireFeature).toHaveBeenCalledWith('SETTINGS_ADS');
  });

  it('returns a clean 401, not a 500, for an unauthenticated request', async () => {
    h.getPrincipal.mockReturnValue(null);
    h.requireFeature.mockImplementationOnce(() => { throw new ForbiddenError('SETTINGS_ADS' as never); });
    const res = await GET(ctx('META', { code: 'c', state: 's' }));

    expect(res.status).toBe(401);
    expect(h.makeAcquisitionAds).not.toHaveBeenCalled();
  });

  it('returns a clean 403, not a 500, when the principal lacks the feature', async () => {
    h.requireFeature.mockImplementationOnce(() => { throw new ForbiddenError('SETTINGS_ADS' as never); });
    const res = await GET(ctx('META', { code: 'c', state: 's' }));

    expect(res.status).toBe(403);
    expect(h.makeAcquisitionAds).not.toHaveBeenCalled();
  });

  it('rejects BING_ADS with a 4xx before calling completeConnection', async () => {
    const res = await GET(ctx('BING_ADS', { code: 'c', state: 's' }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(h.makeAcquisitionAds).not.toHaveBeenCalled();
  });

  it('redirects with a stable error code, never the raw code/state, when code or state is missing', async () => {
    const res = await GET(ctx('META', {}));
    expect(res.status).toBe(302);
    const location = res.headers.get('location')!;
    expect(location).toBe('/settings/ads?error=missing_code_or_state');
  });

  it('redirects to /settings/ads?connected=<platform> on success', async () => {
    const res = await GET(ctx('META', { code: 'c', state: 's' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/settings/ads?connected=META');
  });

  it('triggers the first-connect backfill for every discovered connection id', async () => {
    const context = ctx('META', { code: 'c', state: 's' });
    await GET(context);
    expect(h.triggerFirstConnectBackfill).toHaveBeenCalledWith(context.locals, 'META', ['conn-1', 'conn-2']);
  });

  it('maps an OAuthStateError to a stable invalid_state code, not the exception text', async () => {
    h.complete.mockRejectedValueOnce(new OAuthStateError('nonce already used or expired'));
    const res = await GET(ctx('META', { code: 'c', state: 'stolen-state-xyz' }));

    expect(res.status).toBe(302);
    const location = res.headers.get('location')!;
    expect(location).toBe('/settings/ads?error=invalid_state');
    expect(location).not.toContain('stolen-state-xyz');
    expect(location).not.toMatch(/nonce/i);
  });

  it('maps a NoAdAccountsDiscoveredError to a stable no_ad_accounts code instead of persisting a dead connection', async () => {
    h.complete.mockRejectedValueOnce(new NoAdAccountsDiscoveredError('META'));
    const res = await GET(ctx('META', { code: 'c', state: 's' }));

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/settings/ads?error=no_ad_accounts');
  });

  it('maps any other completion failure to a stable connection_failed code, never the provider error text or a token', async () => {
    h.complete.mockRejectedValueOnce(new Error('token ya29.leaked-secret-value was rejected by provider'));
    const res = await GET(ctx('META', { code: 'c', state: 's' }));

    expect(res.status).toBe(302);
    const location = res.headers.get('location')!;
    expect(location).toBe('/settings/ads?error=connection_failed');
    expect(location).not.toContain('ya29');
    expect(location).not.toContain('leaked-secret-value');
    expect(location.toLowerCase()).not.toContain('token');
  });
});
