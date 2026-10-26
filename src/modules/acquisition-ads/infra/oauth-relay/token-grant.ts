import { createLogger } from '@/lib/logger';
import { canonicalAdsPlatform } from '@/lib/config/ads-apps';
import { metaCapability } from '../platforms/meta/capability';
import { googleCapability } from '../platforms/google/capability';
import { tiktokCapability } from '../platforms/tiktok/capability';
import type { OAuthTokenGrant } from '../../application/ports/outbound';

const logger = createLogger('AdsOAuthRelay');

const DEFAULT_EXPIRES_IN_SEC: Record<'META' | 'GOOGLE' | 'TIKTOK', number> = {
  META: 5_184_000,
  GOOGLE: 3_600,
  TIKTOK: 86_400,
};

function splitScopes(scope: unknown, fallback: string[]): string[] {
  if (typeof scope !== 'string' || !scope.trim()) return fallback;
  return scope.split(/[ ,]+/).filter(Boolean);
}

// Maps the relay's raw token JSON (see oauth-relay.md, section 3) to the core OAuthTokenGrant.
// The relay's `data` field is the platform token endpoint's response, passed through as an
// unparsed JSON string -- this defensive parsing is the only thing standing between a malformed
// or hostile relay payload and a connection row saved with a missing or garbage access token.
export function toGrant(platform: string, rawJson: string): OAuthTokenGrant {
  let json: unknown;
  try {
    json = JSON.parse(rawJson);
  } catch {
    throw new Error('relay token data is not valid JSON');
  }
  if (typeof json !== 'object' || json === null) {
    throw new Error('relay token data is not a JSON object');
  }
  const body = json as Record<string, unknown>;

  const accessToken = body.access_token;
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new Error('relay token data is missing access_token');
  }

  const p = canonicalAdsPlatform(platform);
  if (p === 'BING_ADS') {
    throw new Error('relay does not support BING_ADS');
  }

  const capability = p === 'META' ? metaCapability : p === 'GOOGLE' ? googleCapability : tiktokCapability;
  const expiresInSec = typeof body.expires_in === 'number' ? body.expires_in : DEFAULT_EXPIRES_IN_SEC[p];
  const grantedScopes = splitScopes(body.scope, capability.requiredConversionScopes);

  if (p === 'META') {
    // Meta's long-lived token is re-exchanged rather than refreshed (see MetaOAuthAdapter), so a
    // relay response with no refresh_token is the expected shape, not an error.
    const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : accessToken;
    return { accessToken, refreshToken, expiresInSec, grantedScopes };
  }

  if (p === 'GOOGLE') {
    const refreshToken = body.refresh_token;
    if (typeof refreshToken !== 'string' || !refreshToken) {
      logger.warn('relay returned a GOOGLE grant without a refresh_token');
    }
    return {
      accessToken,
      refreshToken: typeof refreshToken === 'string' ? refreshToken : '',
      expiresInSec,
      grantedScopes,
    };
  }

  // TIKTOK: mapping kept for contract symmetry with the relay doc; RELAY_PLATFORMS.TIKTOK.enabled
  // is false today (see ads-apps.ts), so the authorize route never reaches this branch.
  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : accessToken;
  return { accessToken, refreshToken, expiresInSec, grantedScopes };
}
