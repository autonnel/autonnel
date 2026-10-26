import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';
import { OAuthStateError } from '@/lib/auth/oauth-state';
import { NoAdAccountsDiscoveredError } from '@/modules/acquisition-ads/domain/errors';

export const GET: APIRoute = async ({ request, url, locals }) => {
  await requireFeature('MARKETING');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return new Response(JSON.stringify({ error: 'Missing code or state' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const baseUrl = `${url.protocol}//${url.host}`;
  const redirectUri = `${baseUrl}/api/marketing/oauth/complete`;

  const deps = await createAdsDepsForRequest(locals);
  const ads = await makeAcquisitionAds(deps);
  try {
    const result = await ads.completeConnection.complete({ state, code, redirectUri });
    // Discovery can return more than one account per authorization; only link straight to the
    // detail page when there is exactly one, otherwise send the user to the list.
    const location = result.connectionIds.length === 1 ? `/marketing/${result.connectionIds[0]}` : '/marketing';
    return new Response(null, { status: 302, headers: { Location: location } });
  } catch (err) {
    if (err instanceof OAuthStateError) {
      return new Response(JSON.stringify({ error: 'Invalid or expired authorization state' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (err instanceof NoAdAccountsDiscoveredError) {
      return new Response(JSON.stringify({ error: 'No ad accounts were found for this platform' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw err;
  }
};
