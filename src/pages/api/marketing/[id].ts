import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';

export const GET: APIRoute = async ({ params, locals }) => {
  await requireFeature('MARKETING');
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'ID is required' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const deps = await createAdsDepsForRequest(locals);
  const ads = await makeAcquisitionAds(deps);
  const conn = await ads.connectionRepo.findById(id);
  if (!conn) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify({
    id: conn.id,
    platform: conn.platform,
    externalAccountId: conn.externalAccountId,
    status: conn.status,
    tokenVersion: conn.tokenVersion,
    accessTokenExpiresAt: conn.accessTokenExpiresAt,
    grantedScopes: conn.grantedScopes,
    requiredConversionScopes: conn.requiredConversionScopes,
    isCapiCapable: conn.isCapiCapable(),
    destinations: conn.destinations,
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  await requireFeature('MARKETING');
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'ID is required' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  let body: { name?: string; credentials?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const deps = await createAdsDepsForRequest(locals);
  const ads = await makeAcquisitionAds(deps);
  const conn = await ads.connectionRepo.findById(id);
  if (!conn) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  }
  // name is cosmetic/derived from externalAccountId and is not persisted; only
  // credential changes mutate the connection.
  try {
    await ads.updateTokenConnection.update({ connectionId: id, name: body.name, credentials: body.credentials });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to update ad platform' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  await requireFeature('MARKETING');
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'ID is required' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const deps = await createAdsDepsForRequest(locals);
  const ads = await makeAcquisitionAds(deps);
  const conn = await ads.connectionRepo.findById(id);
  if (!conn) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  }
  conn.revoke('manual');
  await ads.connectionRepo.save(conn);
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json' } });
};
