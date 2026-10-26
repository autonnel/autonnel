import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, string>();
// Two-argument signature matching the real getConfig<T>(key, envFallback): the fallback only
// applies when the key is absent from the store. A one-argument mock that drops envFallback
// cannot exercise the real `value ?? fallback` merge and would hide bugs in every caller that
// relies on it (see readConfigKey in keys.ts, and the getRelayBaseUrl test below).
vi.mock('./get-config', () => ({
  getConfig: vi.fn(async (key: string, envFallback?: unknown) => store.get(key) ?? envFallback),
  setConfig: vi.fn(async (key: string, value: string) => void store.set(key, value)),
  deleteConfig: vi.fn(async (key: string) => void store.delete(key)),
}));

import { getAdsOAuthApp, ADS_APP_KEYS, relayEnabledFor, getRelayBaseUrl } from './ads-apps';

beforeEach(() => store.clear());

describe('ADS_APP_KEYS', () => {
  it('keeps the KV keys the ads plugin already published, which must never be renamed', () => {
    expect(ADS_APP_KEYS.META.clientId.key).toBe('ads.facebook.app_id');
    expect(ADS_APP_KEYS.META.clientSecret.key).toBe('ads.facebook.app_secret');
    expect(ADS_APP_KEYS.TIKTOK.clientId.key).toBe('ads.tiktok.app_id');
    expect(ADS_APP_KEYS.GOOGLE.clientId.key).toBe('ads.google_ads.client_id');
    expect(ADS_APP_KEYS.GOOGLE.developerToken?.key).toBe('ads.google_ads.developer_token');
    expect(ADS_APP_KEYS.BING_ADS.clientId.key).toBe('ads.bing_ads.client_id');
  });
});

describe('getAdsOAuthApp', () => {
  it('returns null when the app is not configured, so callers can degrade instead of throwing', async () => {
    expect(await getAdsOAuthApp('META')).toBeNull();
  });

  it('resolves provider aliases to the canonical platform', async () => {
    store.set('ads.facebook.app_id', 'id');
    store.set('ads.facebook.app_secret', 'secret');
    expect(await getAdsOAuthApp('FACEBOOK')).toEqual({ clientId: 'id', clientSecret: 'secret' });
    expect(await getAdsOAuthApp('meta')).toEqual({ clientId: 'id', clientSecret: 'secret' });
  });

  it('includes the developer token for google ads', async () => {
    store.set('ads.google_ads.client_id', 'gid');
    store.set('ads.google_ads.client_secret', 'gsecret');
    store.set('ads.google_ads.developer_token', 'dev');
    expect(await getAdsOAuthApp('GOOGLE_ADS')).toEqual({
      clientId: 'gid',
      clientSecret: 'gsecret',
      developerToken: 'dev',
    });
  });

  it('returns null when only half the pair is present', async () => {
    store.set('ads.tiktok.app_id', 'id');
    expect(await getAdsOAuthApp('TIKTOK')).toBeNull();
  });
});

describe('relayEnabledFor', () => {
  it('enables the relay for META and GOOGLE but not TIKTOK or BING_ADS', () => {
    expect(relayEnabledFor('META')).toBe(true);
    expect(relayEnabledFor('FACEBOOK')).toBe(true);
    expect(relayEnabledFor('GOOGLE')).toBe(true);
    expect(relayEnabledFor('TIKTOK')).toBe(false);
    expect(relayEnabledFor('BING_ADS')).toBe(false);
  });
});

describe('getRelayBaseUrl', () => {
  // There is no baked-in default relay: shipping one would point every self-hosted install's
  // OAuth authorization at a specific private deployment. Unset must resolve to null so callers
  // treat the relay as unavailable rather than silently redirecting somewhere.
  it('returns null when unconfigured', async () => {
    expect(await getRelayBaseUrl()).toBeNull();
  });

  it('uses a configured base url, trimmed of a trailing slash', async () => {
    store.set('ads.relay.base_url', 'https://relay.example/');
    expect(await getRelayBaseUrl()).toBe('https://relay.example');
  });
});
