import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';

export const GET: APIRoute = async ({ params, request, locals }) => {
  await requireFeature('MARKETING');
  const { platform } = params;
  if (!platform) {
    return new Response(JSON.stringify({ error: 'platform is required' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const redirectUri = `${baseUrl}/api/marketing/oauth/complete`;

  const deps = await createAdsDepsForRequest(locals);
  const ads = await makeAcquisitionAds(deps);
  const result = await ads.startConnection.start({ platform: platform.toUpperCase(), redirectUri });
  return new Response(null, { status: 302, headers: { Location: result.authorizeUrl } });
};
