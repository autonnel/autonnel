import type { APIRoute } from 'astro';
import { requireFeature, getPrincipal, ForbiddenError } from '@/modules/identity/published/principal';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';
import { getAdsOAuthApp, relayEnabledFor, getRelayBaseUrl, canonicalAdsPlatform, RELAY_PLATFORMS } from '@/lib/config/ads-apps';
import { issueOAuthState } from '@/lib/auth/oauth-state';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { unsupportedAdsOAuthPlatform } from './_supported';
import { forbiddenJson } from './_forbidden';

// Two modes, chosen by ?mode=relay (default is 'byo'):
// - byo: the tenant's own OAuth app, credentials from getAdsOAuthApp. Unchanged from before.
// - relay: the hosted OAuth relay already holds credentials; this route only issues a signed
//   state and redirects. See src/pages/api/ads/oauth/relay/callback.ts for the receiving end.
export const GET: APIRoute = async ({ params, request, locals, url }) => {
  // Not defineRoute (this route redirects and returns plain-text errors), so requireFeature's
  // ForbiddenError must be caught here explicitly -- otherwise an unauthenticated or unauthorized
  // request crashes with a raw 500 instead of the 401/403 every other ads endpoint returns.
  try {
    requireFeature('SETTINGS_ADS');
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenJson(getPrincipal() ? 403 : 401);
    throw err;
  }
  const platform = String(params.platform ?? '');
  const unsupported = unsupportedAdsOAuthPlatform(platform);
  if (unsupported) return unsupported;

  if (url.searchParams.get('mode') === 'relay') {
    if (!relayEnabledFor(platform)) {
      return new Response(
        `Hosted relay authorization for "${platform}" is not available yet; use a self-registered OAuth app instead.`,
        { status: 412 },
      );
    }

    // Resolve the relay base before issuing any state: issueOAuthState consumes a single-use
    // nonce, so a request that cannot proceed anyway must not burn one.
    const relayBase = await getRelayBaseUrl();
    if (!relayBase) {
      return new Response(
        'Hosted OAuth relay is not configured; set ads.relay.base_url (env ADS_OAUTH_RELAY_URL) to enable it.',
        { status: 412 },
      );
    }

    // The relay's callback is a cross-site POST with no session cookie, so the state must carry
    // the tenant/user that started the flow; it can only be issued for an interactive user.
    const principal = getPrincipal();
    if (!principal || principal.kind !== 'user') {
      return new Response('Ad account connection requires an interactive user', { status: 401 });
    }

    const state = await issueOAuthState({ platform, tenantId: getCurrentTenantId(), userId: principal.userId });
    const callbackUrl = new URL('/api/ads/oauth/relay/callback', request.url);
    callbackUrl.searchParams.set('state', state);

    const relaySlug = RELAY_PLATFORMS[canonicalAdsPlatform(platform)].slug;
    const relayUrl = `${relayBase}/api/auth/${relaySlug}?callback_url=${encodeURIComponent(callbackUrl.toString())}`;
    return Response.redirect(relayUrl, 302);
  }

  const app = await getAdsOAuthApp(platform);
  if (!app) return new Response('Ad platform app is not configured', { status: 412 });

  const ads = await makeAcquisitionAds(await createAdsDepsForRequest(locals));
  const redirectUri = new URL(`/api/ads/oauth/${platform}/callback`, request.url).toString();
  const { authorizeUrl } = await ads.startConnection.start({ platform, redirectUri });
  return Response.redirect(authorizeUrl, 302);
};
