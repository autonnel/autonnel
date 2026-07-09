import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';

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
  const result = await ads.completeConnection.complete({ state, code, redirectUri });
  return new Response(null, { status: 302, headers: { Location: `/marketing/${result.connectionId}` } });
};
