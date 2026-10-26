import type { APIRoute } from 'astro';
import { requireFeature, getPrincipal, ForbiddenError } from '@/modules/identity/published/principal';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';
import { OAuthStateError } from '@/lib/auth/oauth-state';
import { NoAdAccountsDiscoveredError } from '@/modules/acquisition-ads/domain/errors';
import { createLogger } from '@/lib/logger';
import { triggerFirstConnectBackfill } from '@/composition/trigger-ad-insights-backfill';
import { unsupportedAdsOAuthPlatform } from './_supported';
import { forbiddenJson } from './_forbidden';

const logger = createLogger('AdsOAuthCallback');

function redirectToSettings(params: Record<string, string>): Response {
  const query = new URLSearchParams(params).toString();
  return new Response(null, { status: 302, headers: { Location: `/settings/ads?${query}` } });
}

export const GET: APIRoute = async ({ params, request, url, locals }) => {
  // Not defineRoute (this route redirects to /settings/ads on every other error path), so
  // requireFeature's ForbiddenError must be caught here explicitly -- otherwise an unauthenticated
  // or unauthorized request crashes with a raw 500 instead of the 401/403 every other ads endpoint
  // returns.
  try {
    requireFeature('SETTINGS_ADS');
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenJson(getPrincipal() ? 403 : 401);
    throw err;
  }
  const platform = String(params.platform ?? '');
  const unsupported = unsupportedAdsOAuthPlatform(platform);
  if (unsupported) return unsupported;

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return redirectToSettings({ error: 'missing_code_or_state' });

  const redirectUri = new URL(`/api/ads/oauth/${platform}/callback`, request.url).toString();
  const ads = await makeAcquisitionAds(await createAdsDepsForRequest(locals));

  try {
    // decodeState must reuse the shared consumeOAuthState (single-use HMAC state bound to the
    // principal that started the flow); relaxing this lets a victim's browser complete an
    // attacker-initiated authorization.
    const { connectionIds } = await ads.completeConnection.complete({ code, state, redirectUri });
    triggerFirstConnectBackfill(locals, platform, connectionIds);
    return redirectToSettings({ connected: platform });
  } catch (err) {
    if (err instanceof OAuthStateError) {
      logger.warn('ads oauth callback rejected an invalid or expired state', { platform, error: err });
      return redirectToSettings({ error: 'invalid_state' });
    }
    if (err instanceof NoAdAccountsDiscoveredError) {
      logger.warn('ads oauth callback authorized but discovered no ad accounts', { platform, error: err });
      return redirectToSettings({ error: 'no_ad_accounts' });
    }
    logger.error('ads oauth callback failed to complete the connection', { platform, error: err });
    return redirectToSettings({ error: 'connection_failed' });
  }
};
