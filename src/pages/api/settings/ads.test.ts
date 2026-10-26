import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  readConfigKey: vi.fn(),
  setConfig: vi.fn(),
  deleteConfig: vi.fn(),
  findManyConnections: vi.fn(),
}));

vi.mock('@/lib/config/keys', async () => {
  const actual = await vi.importActual<typeof import('@/lib/config/keys')>('@/lib/config/keys');
  return { ...actual, readConfigKey: h.readConfigKey };
});
vi.mock('@/lib/config/get-config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/config/get-config')>('@/lib/config/get-config');
  return { ...actual, setConfig: h.setConfig, deleteConfig: h.deleteConfig };
});
vi.mock('@/modules/platform/infra/prisma-tenant-extension', () => ({
  getTenantPrisma: () => ({ adAccountConnection: { findMany: h.findManyConnections } }),
}));

import { GET, PUT } from './ads';
import { runWithContext } from '@/modules/identity/infra/als-tenant-context';
import { PermissionSet } from '@/modules/identity/domain/permission-set';
import { toFeatureKey } from '@/modules/identity/domain/feature-key';

const principal = {
  kind: 'user' as const,
  userId: 'u1',
  tenantId: 'default',
  permissions: PermissionSet.of([toFeatureKey('SETTINGS_ADS')]),
};

function ctx(method: 'GET' | 'PUT', body?: unknown) {
  return {
    request: new Request('http://test/api/settings/ads', {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    params: {},
    locals: {},
  } as never;
}

const callGet = () => runWithContext({ tenantId: 'default', principal }, async () => GET(ctx('GET')));
const callPut = (body: unknown) => runWithContext({ tenantId: 'default', principal }, async () => PUT(ctx('PUT', body)));

beforeEach(() => {
  vi.clearAllMocks();
  h.findManyConnections.mockResolvedValue([]);
  h.readConfigKey.mockResolvedValue(undefined);
});

describe('GET /api/settings/ads', () => {
  it('never returns clientSecret or developerToken values, even when configured', async () => {
    h.readConfigKey.mockImplementation(async (spec: { key: string }) => {
      if (spec.key.includes('developer_token')) return 'dev-token-value';
      if (spec.key.includes('secret')) return 'super-secret-value';
      return 'abcd1234';
    });

    const res = (await callGet()) as Response;
    const text = await res.text();
    expect(text).not.toContain('super-secret-value');
    expect(text).not.toContain('dev-token-value');

    const body = JSON.parse(text) as { platforms: Array<Record<string, unknown>> };
    for (const platform of body.platforms) {
      expect(platform).not.toHaveProperty('clientSecret');
      expect(platform).not.toHaveProperty('developerToken');
    }

    const meta = body.platforms.find((p) => p.platform === 'META')!;
    expect(meta.hasConfig).toBe(true);
    expect(meta.clientIdMasked).toBe('••••1234');

    const google = body.platforms.find((p) => p.platform === 'GOOGLE')!;
    expect(google.hasDeveloperToken).toBe(true);
  });

  it('marks a platform unconfigured when clientId/secret are unset', async () => {
    const res = (await callGet()) as Response;
    const body = (await res.json()) as { platforms: Array<Record<string, unknown>> };
    for (const platform of body.platforms) {
      expect(platform.hasConfig).toBe(false);
      expect(platform.clientIdMasked).toBe('');
    }
  });

  it('exposes relayEnabled false for every platform when no relay url is configured', async () => {
    const res = (await callGet()) as Response;
    const body = (await res.json()) as { platforms: Array<{ platform: string; relayEnabled: boolean }> };
    const byPlatform = Object.fromEntries(body.platforms.map((p) => [p.platform, p.relayEnabled]));
    expect(byPlatform).toEqual({ META: false, TIKTOK: false, GOOGLE: false, BING_ADS: false });
  });

  it('exposes relayEnabled true only for Meta and Google once a relay url is configured', async () => {
    h.readConfigKey.mockImplementation(async (spec: { key: string }) => {
      if (spec.key === 'ads.relay.base_url') return 'https://relay.example';
      return undefined;
    });
    const res = (await callGet()) as Response;
    const body = (await res.json()) as { platforms: Array<{ platform: string; relayEnabled: boolean }> };
    const byPlatform = Object.fromEntries(body.platforms.map((p) => [p.platform, p.relayEnabled]));
    expect(byPlatform).toEqual({ META: true, TIKTOK: false, GOOGLE: true, BING_ADS: false });
  });

  it('groups connections by canonical platform, tolerating legacy alias strings', async () => {
    h.findManyConnections.mockResolvedValue([
      { id: 'c1', platform: 'FACEBOOK', externalAccountId: 'act_1', status: 'ACTIVE', reportingTimezone: 'UTC' },
      { id: 'c2', platform: 'GOOGLE', externalAccountId: 'cust_2', status: 'ACTIVE', reportingTimezone: null },
    ]);
    const res = (await callGet()) as Response;
    const body = (await res.json()) as { platforms: Array<{ platform: string; connections: unknown[] }> };
    const meta = body.platforms.find((p) => p.platform === 'META')!;
    expect(meta.connections).toEqual([{ id: 'c1', externalAccountId: 'act_1', status: 'ACTIVE', reportingTimezone: 'UTC' }]);
  });
});

describe('PUT /api/settings/ads', () => {
  it('rejects a request without a known platform', async () => {
    const res = (await callPut({ clientId: 'x' })) as Response;
    expect(res.status).toBe(400);
    expect(h.setConfig).not.toHaveBeenCalled();
  });

  it('deletes the client id when sent as an empty string', async () => {
    await callPut({ platform: 'META', clientId: '' });
    expect(h.deleteConfig).toHaveBeenCalledWith(expect.stringContaining('facebook.app_id'));
  });

  it('blank clientSecret keeps the existing value instead of clearing it', async () => {
    await callPut({ platform: 'META', clientId: 'abc', clientSecret: '' });
    expect(h.setConfig).toHaveBeenCalledWith(expect.stringContaining('app_id'), 'abc');
    expect(h.setConfig).not.toHaveBeenCalledWith(expect.stringContaining('secret'), expect.anything());
    expect(h.deleteConfig).not.toHaveBeenCalledWith(expect.stringContaining('secret'));
  });

  it('null clientSecret clears the stored value', async () => {
    await callPut({ platform: 'META', clientSecret: null });
    expect(h.deleteConfig).toHaveBeenCalledWith(expect.stringContaining('app_secret'));
  });

  it('ignores a developerToken field for a platform that has none', async () => {
    await callPut({ platform: 'META', developerToken: 'whatever' });
    expect(h.setConfig).not.toHaveBeenCalledWith(expect.stringContaining('developer_token'), expect.anything());
  });

  it('blank developerToken keeps the built-in default for Google', async () => {
    await callPut({ platform: 'GOOGLE', developerToken: '' });
    expect(h.setConfig).not.toHaveBeenCalledWith(expect.stringContaining('developer_token'), expect.anything());
    expect(h.deleteConfig).not.toHaveBeenCalledWith(expect.stringContaining('developer_token'));
  });

  it('null developerToken clears an override for Google', async () => {
    await callPut({ platform: 'GOOGLE', developerToken: null });
    expect(h.deleteConfig).toHaveBeenCalledWith(expect.stringContaining('developer_token'));
  });
});
