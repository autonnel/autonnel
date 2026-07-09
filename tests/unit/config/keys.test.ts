import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getConfigMock, readEnvMock } = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
  readEnvMock: vi.fn((name: string) => `env:${name}`),
}));

vi.mock('@/lib/config/get-config', () => ({
  getConfig: getConfigMock,
}));
// envFallback on a ConfigKey is the NAME of an env var; readConfigKey resolves it to a
// value via readEnv and forwards (key, value) to getConfig. The mock echoes the name so
// assertions can prove both the right env var was read and its value was forwarded.
vi.mock('@/lib/runtime/env', () => ({
  readEnv: readEnvMock,
}));

import {
  ConfigKeys,
  readConfigKey,
  getOAuthClientId,
  getOAuthClientSecret,
  getOAuthAuthorizationUrl,
  getOAuthTokenUrl,
  getOAuthUserInfoUrl,
  getOAuthRedirectUri,
  getOAuthScopes,
  getGoogleMapsApiKey,
  getDefaultCdnUrl,
  getPermissionsAdminIdsRaw,
  getMqDefaultTopic,
} from '@/lib/config/keys';

beforeEach(() => {
  getConfigMock.mockReset();
  getConfigMock.mockResolvedValue('value-from-getConfig');
  readEnvMock.mockReset();
  readEnvMock.mockImplementation((name: string) => `env:${name}`);
});

describe('ConfigKeys registry', () => {
  it('declares stable KV keys (lowercase dotted) for each entry', () => {
    for (const [name, spec] of Object.entries(ConfigKeys)) {
      expect(spec.key, `${name} should have a key`).toMatch(/^[a-z][a-z0-9_.]*$/);
      expect(spec.envFallback, `${name} should have envFallback`).toBeTruthy();
    }
  });

  it.each([
    ['OAUTH_CLIENT_ID',          'oauth.client_id',          'OAUTH_CLIENT_ID'],
    ['OAUTH_CLIENT_SECRET',      'oauth.client_secret',      'OAUTH_CLIENT_SECRET'],
    ['OAUTH_AUTHORIZATION_URL',  'oauth.authorization_url',  'OAUTH_AUTHORIZATION_URL'],
    ['OAUTH_TOKEN_URL',          'oauth.token_url',          'OAUTH_TOKEN_URL'],
    ['OAUTH_USER_INFO_URL',      'oauth.user_info_url',      'OAUTH_USER_INFO_URL'],
    ['OAUTH_REDIRECT_URI',       'oauth.redirect_uri',       'OAUTH_REDIRECT_URI'],
    ['OAUTH_SCOPES',             'oauth.scopes',             'OAUTH_SCOPES'],
    ['GOOGLE_MAPS_API_KEY',      'google_maps.api_key',      'GOOGLE_MAPS_API_KEY'],
    ['DEFAULT_CDN_URL',          'cdn.default_url',          'DEFAULT_CDN_URL'],
    ['PERMISSIONS_ADMIN_USER_IDS', 'permissions.admin_user_ids', 'PERMISSIONS_ADMIN_USER_IDS'],
    ['MQ_DEFAULT_TOPIC',         'mq.default_topic',         'MQ_DEFAULT_TOPIC'],
  ])('maps %s to (%s, %s)', (name, key, envFallback) => {
    const spec = (ConfigKeys as Record<string, { key: string; envFallback: string }>)[name];
    expect(spec.key).toBe(key);
    expect(spec.envFallback).toBe(envFallback);
  });
});

describe('readConfigKey', () => {
  it('resolves the envFallback name to its env value and forwards (key, value) to getConfig', async () => {
    await readConfigKey(ConfigKeys.OAUTH_CLIENT_ID);
    expect(readEnvMock).toHaveBeenCalledWith('OAUTH_CLIENT_ID');
    expect(getConfigMock).toHaveBeenCalledWith('oauth.client_id', 'env:OAUTH_CLIENT_ID');
  });
});

describe('typed accessors wire the right key/envFallback', () => {
  const cases: Array<[string, () => Promise<unknown>, string, string]> = [
    ['getOAuthClientId',         getOAuthClientId,        'oauth.client_id',         'OAUTH_CLIENT_ID'],
    ['getOAuthClientSecret',     getOAuthClientSecret,    'oauth.client_secret',     'OAUTH_CLIENT_SECRET'],
    ['getOAuthAuthorizationUrl', getOAuthAuthorizationUrl,'oauth.authorization_url', 'OAUTH_AUTHORIZATION_URL'],
    ['getOAuthTokenUrl',         getOAuthTokenUrl,        'oauth.token_url',         'OAUTH_TOKEN_URL'],
    ['getOAuthUserInfoUrl',      getOAuthUserInfoUrl,     'oauth.user_info_url',     'OAUTH_USER_INFO_URL'],
    ['getOAuthRedirectUri',      getOAuthRedirectUri,     'oauth.redirect_uri',      'OAUTH_REDIRECT_URI'],
    ['getOAuthScopes',           getOAuthScopes,          'oauth.scopes',            'OAUTH_SCOPES'],
    ['getGoogleMapsApiKey',      getGoogleMapsApiKey,     'google_maps.api_key',     'GOOGLE_MAPS_API_KEY'],
    ['getDefaultCdnUrl',         getDefaultCdnUrl,        'cdn.default_url',         'DEFAULT_CDN_URL'],
    ['getPermissionsAdminIdsRaw', getPermissionsAdminIdsRaw, 'permissions.admin_user_ids', 'PERMISSIONS_ADMIN_USER_IDS'],
    ['getMqDefaultTopic',        getMqDefaultTopic,       'mq.default_topic',        'MQ_DEFAULT_TOPIC'],
  ];

  it.each(cases)('%s calls getConfig with the key + resolved env value', async (_, fn, key, envFallback) => {
    getConfigMock.mockResolvedValueOnce('returned');
    const result = await fn();
    expect(readEnvMock).toHaveBeenCalledWith(envFallback);
    expect(getConfigMock).toHaveBeenCalledWith(key, `env:${envFallback}`);
    expect(result).toBe('returned');
  });
});
