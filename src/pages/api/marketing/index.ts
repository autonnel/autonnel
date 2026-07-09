import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';

export const GET: APIRoute = async ({ locals }) => {
  await requireFeature('MARKETING');
  const deps = await createAdsDepsForRequest(locals);
  const ads = await makeAcquisitionAds(deps);
  const connections = await ads.connectionRepo.list();
  return new Response(JSON.stringify(connections.map((c) => ({
    id: c.id,
    platform: c.platform,
    externalAccountId: c.externalAccountId,
    status: c.status,
    isCapiCapable: c.isCapiCapable(),
    destinationCount: c.destinations.length,
  }))), { status: 200, headers: { 'content-type': 'application/json' } });
};

export const POST: APIRoute = async ({ request, locals }) => {
  await requireFeature('MARKETING');
  let body: { name?: string; platform?: string; credentials?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const name = body?.name?.trim();
  const platform = body?.platform;
  const credentials = body?.credentials;
  if (!name || !platform || !credentials || typeof credentials !== 'object') {
    return new Response(JSON.stringify({ error: 'name, platform and credentials are required' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const deps = await createAdsDepsForRequest(locals);
  const ads = await makeAcquisitionAds(deps);
  try {
    const { id } = await ads.createTokenConnection.create({ name, platform, credentials });
    return new Response(JSON.stringify({ id }), { status: 201, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to connect ad platform' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
};
