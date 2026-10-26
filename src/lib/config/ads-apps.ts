import { ConfigKeys, readConfigKey } from './keys';

export type AdsAppPlatform = 'META' | 'TIKTOK' | 'GOOGLE' | 'BING_ADS';

// These KV keys were published by the paid ads plugin. Renaming them would orphan every tenant row
// already written against them, so they stay exactly as they were.
export const ADS_APP_KEYS = {
  META: { clientId: ConfigKeys.ADS_FACEBOOK_APP_ID, clientSecret: ConfigKeys.ADS_FACEBOOK_APP_SECRET },
  TIKTOK: { clientId: ConfigKeys.ADS_TIKTOK_APP_ID, clientSecret: ConfigKeys.ADS_TIKTOK_APP_SECRET },
  GOOGLE: {
    clientId: ConfigKeys.ADS_GOOGLE_CLIENT_ID,
    clientSecret: ConfigKeys.ADS_GOOGLE_CLIENT_SECRET,
    developerToken: ConfigKeys.ADS_GOOGLE_DEVELOPER_TOKEN,
  },
  BING_ADS: { clientId: ConfigKeys.ADS_BING_CLIENT_ID, clientSecret: ConfigKeys.ADS_BING_CLIENT_SECRET },
} as const;

// Connections/UI store provider aliases ('FACEBOOK', 'GOOGLE_ADS') while this module and the
// platform adapters key on 'META'/'GOOGLE'/'TIKTOK'/'BING_ADS'. This is the single canonical
// mapping; anything else that resolves a platform to a KV key must call this, not reimplement it.
export function canonicalAdsPlatform(input: string): AdsAppPlatform {
  const p = input.toUpperCase().replace(/-/g, '_');
  if (p === 'META' || p === 'FACEBOOK') return 'META';
  if (p === 'GOOGLE' || p === 'GOOGLE_ADS') return 'GOOGLE';
  if (p === 'BING' || p === 'BING_ADS') return 'BING_ADS';
  return 'TIKTOK';
}

export interface AdsOAuthApp {
  clientId: string;
  clientSecret: string;
  developerToken?: string;
}

export async function getAdsOAuthApp(platform: string): Promise<AdsOAuthApp | null> {
  const keys = ADS_APP_KEYS[canonicalAdsPlatform(platform)];
  // readConfigKey resolves envFallback through readEnv (the env VAR NAME -> its VALUE); calling
  // getConfig directly with `.envFallback` falls back to the var NAME string itself, which is
  // always truthy and makes every platform look configured even with nothing set.
  const [clientId, clientSecret] = await Promise.all([
    readConfigKey<string>(keys.clientId),
    readConfigKey<string>(keys.clientSecret),
  ]);
  if (!clientId || !clientSecret) return null;

  const developerTokenKey = 'developerToken' in keys ? keys.developerToken : undefined;
  const developerToken = developerTokenKey ? await readConfigKey<string>(developerTokenKey) : undefined;

  return developerToken ? { clientId, clientSecret, developerToken } : { clientId, clientSecret };
}

// Hosted OAuth relay: lets a user authorize without registering their own OAuth app, by
// delegating to a relay app that already holds platform credentials. Contract: the browser is
// redirected to `<relayBase>/api/auth/<slug>?callback_url=<absolute url>`, and the relay then
// makes a cross-site form POST back to that callback_url carrying `platform` plus either `data`
// (the platform's raw token JSON as a string) or `error`. There is no default relay; it is only
// available once an operator configures ConfigKeys.ADS_RELAY_BASE_URL.

// Relay platform slugs differ from our canonical platform names.
// TIKTOK is deliberately disabled: the relay's current TikTok authorization targets the creator
// content API (tiktok.com/v2/auth/authorize, user.info/video/comment scopes), not the Ads Marketing
// API, so its token cannot read ad insights. Flip `enabled` when the relay ships an Ads endpoint;
// the contract is unchanged, so nothing else needs to move.
export const RELAY_PLATFORMS: Record<AdsAppPlatform, { slug: string; enabled: boolean }> = {
  META: { slug: 'facebook', enabled: true },
  GOOGLE: { slug: 'google', enabled: true },
  TIKTOK: { slug: 'tiktok', enabled: false },
  BING_ADS: { slug: '', enabled: false },
};

export function relayEnabledFor(platform: string): boolean {
  return RELAY_PLATFORMS[canonicalAdsPlatform(platform)].enabled;
}

export async function getRelayBaseUrl(): Promise<string | null> {
  const configured = await readConfigKey<string>(ConfigKeys.ADS_RELAY_BASE_URL);
  const trimmed = configured?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : null;
}
