import type { APIRoute } from 'astro';
import { consumeRelayState } from '@/lib/auth/oauth-state';
import { relayEnabledFor } from '@/lib/config/ads-apps';
import { toGrant } from '@/modules/acquisition-ads/infra/oauth-relay/token-grant';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';
import { runWithTenant } from '@/lib/tenant/context';
import { NoAdAccountsDiscoveredError } from '@/modules/acquisition-ads/domain/errors';
import { createLogger } from '@/lib/logger';
import { triggerFirstConnectBackfill } from '@/composition/trigger-ad-insights-backfill';

const logger = createLogger('AdsOAuthRelayCallback');

function redirectToSettings(params: Record<string, string>): Response {
  const query = new URLSearchParams(params).toString();
  return new Response(null, { status: 302, headers: { Location: `/settings/ads?${query}` } });
}

// Receives the hosted OAuth relay's cross-site POST (see docs/oauth-relay.md and
// src/pages/api/ads/oauth/[platform]/authorize.ts's ?mode=relay branch). Not defineRoute: the
// relay posts application/x-www-form-urlencoded, which defineRoute cannot parse.
//
// No session cookie arrives here (SameSite=Lax blocks it on a cross-site POST), so this endpoint
// is intentionally unauthenticated -- the signed, single-use state is the only thing standing
// between an arbitrary POST and attaching a forged ad account to someone else's tenant. Every
// branch below redirects with a stable error code only: never the relay's raw `error` text, the
// raw `data`, or a token, since any of those landing in a Location header would leak into the
// browser's history and any tools that read it.
export const POST: APIRoute = async ({ request, url, locals }) => {
  const state = url.searchParams.get('state');
  if (!state) return redirectToSettings({ error: 'missing_state' });

  let claim: { platform: string; tenantId: string; userId: string };
  try {
    claim = await consumeRelayState(state);
  } catch (err) {
    logger.warn('relay callback rejected a forged, replayed, or expired state', { error: err });
    return redirectToSettings({ error: 'invalid_state' });
  }

  // The state payload doesn't record which flow issued it (issueOAuthState is shared with the
  // byo authorize path), so a validly-signed, unconsumed state minted for a relay-disabled
  // platform (e.g. a user's own TikTok byo authorize redirect) would otherwise pass every check
  // above. Re-check the policy here, before touching the form body at all, rather than trusting
  // that only relay-enabled authorize requests ever produce a state.
  if (!relayEnabledFor(claim.platform)) {
    logger.warn('relay callback received a state for a relay-disabled platform', { platform: claim.platform });
    return redirectToSettings({ error: 'relay_disabled' });
  }

  const form = await request.formData();
  const errorField = form.get('error');
  if (typeof errorField === 'string' && errorField) {
    logger.warn('ad platform relay reported an authorization failure', { platform: claim.platform, error: errorField });
    return redirectToSettings({ error: 'provider_error' });
  }

  const raw = form.get('data');
  if (typeof raw !== 'string' || !raw) {
    return redirectToSettings({ error: 'missing_token' });
  }

  let grant;
  try {
    grant = toGrant(claim.platform, raw);
  } catch (err) {
    logger.warn('relay token data failed to map to an OAuth grant', { platform: claim.platform, error: err });
    return redirectToSettings({ error: 'invalid_token' });
  }

  try {
    await runWithTenant(claim.tenantId, async () => {
      const ads = await makeAcquisitionAds(await createAdsDepsForRequest());
      const { connectionIds } = await ads.completeConnection.completeFromGrant({ platform: claim.platform, grant });
      triggerFirstConnectBackfill(locals, claim.platform, connectionIds);
    });
  } catch (err) {
    if (err instanceof NoAdAccountsDiscoveredError) {
      logger.warn('relay callback authorized but discovered no ad accounts', { platform: claim.platform, error: err });
      return redirectToSettings({ error: 'no_ad_accounts' });
    }
    logger.error('failed to persist an ad account connection from the relay grant', { platform: claim.platform, error: err });
    return redirectToSettings({ error: 'connection_failed' });
  }

  return redirectToSettings({ connected: claim.platform });
};
