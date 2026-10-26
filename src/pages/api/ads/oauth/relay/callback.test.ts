import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoAdAccountsDiscoveredError } from '@/modules/acquisition-ads/domain/errors';

const h = vi.hoisted(() => ({
  consumeRelayState: vi.fn(async (_state: string) => ({ platform: 'META', tenantId: 'tenant-1', userId: 'user-1' })),
  toGrant: vi.fn(() => ({
    accessToken: 'relay-access-token',
    refreshToken: 'relay-refresh-token',
    expiresInSec: 5_184_000,
    grantedScopes: ['ads_management'],
  })),
  completeFromGrant: vi.fn(async () => ({ connectionIds: ['conn-1', 'conn-2'] })),
  makeAcquisitionAds: vi.fn(async () => ({ completeConnection: { completeFromGrant: h.completeFromGrant } })),
  runWithTenant: vi.fn((_tenantId: string, fn: () => unknown) => fn()),
  triggerFirstConnectBackfill: vi.fn(),
}));

vi.mock('@/lib/auth/oauth-state', () => ({ consumeRelayState: h.consumeRelayState }));
vi.mock('@/modules/acquisition-ads/infra/oauth-relay/token-grant', () => ({ toGrant: h.toGrant }));
vi.mock('@/composition/make-acquisition-ads', () => ({ makeAcquisitionAds: h.makeAcquisitionAds }));
vi.mock('@/composition/make-ads-deps', () => ({ createAdsDepsForRequest: vi.fn(async () => ({})) }));
vi.mock('@/composition/trigger-ad-insights-backfill', () => ({
  triggerFirstConnectBackfill: h.triggerFirstConnectBackfill,
}));
vi.mock('@/lib/tenant/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tenant/context')>();
  return { ...actual, runWithTenant: h.runWithTenant };
});

const { consumeRelayState, toGrant, completeFromGrant, makeAcquisitionAds, runWithTenant, triggerFirstConnectBackfill } = h;

import { POST } from './callback';

function ctx(query: Record<string, string>, form?: Record<string, string>): any {
  const url = new URL('https://x.test/api/ads/oauth/relay/callback');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const body = new URLSearchParams(form ?? {});
  const request = new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return { request, url, locals: {} };
}

beforeEach(() => {
  consumeRelayState.mockClear();
  consumeRelayState.mockResolvedValue({ platform: 'META', tenantId: 'tenant-1', userId: 'user-1' });
  toGrant.mockClear();
  toGrant.mockReturnValue({
    accessToken: 'relay-access-token',
    refreshToken: 'relay-refresh-token',
    expiresInSec: 5_184_000,
    grantedScopes: ['ads_management'],
  });
  completeFromGrant.mockClear();
  completeFromGrant.mockResolvedValue({ connectionIds: ['conn-1', 'conn-2'] });
  makeAcquisitionAds.mockClear();
  runWithTenant.mockClear();
  triggerFirstConnectBackfill.mockClear();
});

describe('POST /api/ads/oauth/relay/callback', () => {
  it('redirects with missing_state when the query has no state', async () => {
    const res = await POST(ctx({}, { platform: 'facebook', data: '{}' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/settings/ads?error=missing_state');
    expect(consumeRelayState).not.toHaveBeenCalled();
  });

  it('rejects a forged or replayed state with a stable code and no state value in the Location header', async () => {
    consumeRelayState.mockRejectedValueOnce(new Error('unknown or already-used state'));
    const res = await POST(ctx({ state: 'stolen-or-replayed-state-xyz' }, { platform: 'facebook', data: '{}' }));

    expect(res.status).toBe(302);
    const location = res.headers.get('location')!;
    expect(location).toBe('/settings/ads?error=invalid_state');
    expect(location).not.toContain('stolen-or-replayed-state-xyz');
    expect(makeAcquisitionAds).not.toHaveBeenCalled();
  });

  it('maps a relay error field to a stable provider_error code, never echoing the error text', async () => {
    const res = await POST(ctx({ state: 's' }, { platform: 'facebook', error: 'Failed to obtain access token' }));

    expect(res.status).toBe(302);
    const location = res.headers.get('location')!;
    expect(location).toBe('/settings/ads?error=provider_error');
    expect(location).not.toContain('Failed');
    expect(location).not.toContain('access');
    expect(makeAcquisitionAds).not.toHaveBeenCalled();
  });

  it('redirects with missing_token when data is absent', async () => {
    const res = await POST(ctx({ state: 's' }, { platform: 'facebook' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/settings/ads?error=missing_token');
    expect(toGrant).not.toHaveBeenCalled();
  });

  it('redirects with invalid_token when toGrant rejects the payload, leaking no token text', async () => {
    toGrant.mockImplementationOnce(() => {
      throw new Error('relay token data is missing access_token');
    });
    const res = await POST(ctx({ state: 's' }, { platform: 'facebook', data: '{"token_type":"bearer"}' }));

    expect(res.status).toBe(302);
    const location = res.headers.get('location')!;
    expect(location).toBe('/settings/ads?error=invalid_token');
    expect(location).not.toContain('access_token');
  });

  it('runs completeFromGrant inside the state-carried tenant and redirects with connected=<platform>', async () => {
    const res = await POST(ctx({ state: 's' }, { platform: 'facebook', data: '{"access_token":"secret-token-value"}' }));

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/settings/ads?connected=META');
    expect(runWithTenant).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(completeFromGrant).toHaveBeenCalledWith(expect.objectContaining({ platform: 'META' }));
    expect(res.headers.get('location')).not.toContain('secret-token-value');
  });

  it('triggers the first-connect backfill for every discovered connection id, inside the state-carried tenant', async () => {
    const context = ctx({ state: 's' }, { platform: 'facebook', data: '{"access_token":"secret-token-value"}' });
    await POST(context);
    expect(triggerFirstConnectBackfill).toHaveBeenCalledWith(context.locals, 'META', ['conn-1', 'conn-2']);
  });

  it('redirects with no_ad_accounts, never a generic connection_failed, when discovery finds zero accounts', async () => {
    completeFromGrant.mockRejectedValueOnce(new NoAdAccountsDiscoveredError('META'));
    const res = await POST(ctx({ state: 's' }, { platform: 'facebook', data: '{"access_token":"secret-token-value"}' }));

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/settings/ads?error=no_ad_accounts');
  });

  it('redirects with connection_failed, never a token or provider text, when persistence throws', async () => {
    completeFromGrant.mockRejectedValueOnce(new Error('db write failed for token ya29.leaked'));
    const res = await POST(ctx({ state: 's' }, { platform: 'facebook', data: '{"access_token":"ya29.leaked"}' }));

    expect(res.status).toBe(302);
    const location = res.headers.get('location')!;
    expect(location).toBe('/settings/ads?error=connection_failed');
    expect(location).not.toContain('ya29');
    expect(location).not.toContain('leaked');
  });

  it('rejects a state for a relay-disabled platform (TIKTOK) before any token parsing, never persisting a connection', async () => {
    consumeRelayState.mockResolvedValueOnce({ platform: 'TIKTOK', tenantId: 'tenant-1', userId: 'user-1' });
    const res = await POST(ctx({ state: 's' }, { platform: 'tiktok', data: '{"access_token":"attacker-chosen-token"}' }));

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/settings/ads?error=relay_disabled');
    expect(toGrant).not.toHaveBeenCalled();
    expect(makeAcquisitionAds).not.toHaveBeenCalled();
    expect(completeFromGrant).not.toHaveBeenCalled();
  });

  it('rejects a state genuinely minted for TIKTOK the same way the byo authorize path mints it (issueOAuthState), proving the check holds against a real state, not just a mocked platform value', async () => {
    // A validly-signed, unconsumed state doesn't record which flow issued it -- issueOAuthState is
    // shared between byo authorize and the relay authorize branch -- so this reproduces a user
    // harvesting their own byo TikTok authorize state and posting it straight to this endpoint.
    const real = await vi.importActual<typeof import('@/lib/auth/oauth-state')>('@/lib/auth/oauth-state');
    const state = await real.issueOAuthState({ platform: 'TIKTOK', tenantId: 'tenant-1', userId: 'user-1' });
    consumeRelayState.mockImplementationOnce(real.consumeRelayState);

    const res = await POST(ctx({ state }, { platform: 'tiktok', data: '{"access_token":"attacker-chosen-token"}' }));

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/settings/ads?error=relay_disabled');
    expect(toGrant).not.toHaveBeenCalled();
    expect(makeAcquisitionAds).not.toHaveBeenCalled();
    expect(completeFromGrant).not.toHaveBeenCalled();
  });
});
