import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';

export const GET: APIRoute = async ({ params, locals }) => {
  await requireFeature('FUNNELS');
  const funnelId = params.id;
  if (!funnelId) {
    return new Response(JSON.stringify({ error: 'Funnel ID is required' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const deps = await createAdsDepsForRequest(locals);
  const ads = await makeAcquisitionAds(deps);
  const bindings = await ads.funnelBindingRepo.listByFunnel(funnelId);
  const connectionIds = bindings.map((b) => b.connectionId);
  const connections = await ads.connectionRepo.list();
  const bound = connections.filter((c) => connectionIds.includes(c.id));
  return new Response(JSON.stringify(bound.map((c) => ({
    id: c.id,
    platform: c.platform,
    externalAccountId: c.externalAccountId,
    status: c.status,
    isCapiCapable: c.isCapiCapable(),
  }))), { status: 200, headers: { 'content-type': 'application/json' } });
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  await requireFeature('FUNNELS');
  const funnelId = params.id;
  if (!funnelId) {
    return new Response(JSON.stringify({ error: 'Funnel ID is required' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  let body: { connectionId: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  if (!body.connectionId) {
    return new Response(JSON.stringify({ error: 'connectionId is required' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const deps = await createAdsDepsForRequest(locals);
  const ads = await makeAcquisitionAds(deps);
  const conn = await ads.connectionRepo.findById(body.connectionId);
  if (!conn) {
    return new Response(JSON.stringify({ error: 'Connection not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  }
  const existing = await ads.funnelBindingRepo.listByFunnel(funnelId);
  const platformConnections = await ads.connectionRepo.list();
  const alreadyBound = platformConnections.filter((c) =>
    existing.some((b) => b.connectionId === c.id) && c.platform === conn.platform
  );
  if (alreadyBound.length > 0) {
    return new Response(JSON.stringify({ error: 'A connection for this platform is already bound to the funnel' }), { status: 409, headers: { 'content-type': 'application/json' } });
  }
  await ads.funnelBindingRepo.bind(funnelId, conn.id);
  return new Response(JSON.stringify({ success: true, funnelId, connectionId: conn.id, platform: conn.platform }), { status: 201, headers: { 'content-type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  await requireFeature('FUNNELS');
  const funnelId = params.id;
  if (!funnelId) {
    return new Response(JSON.stringify({ error: 'Funnel ID is required' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  let body: { connectionId: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  if (!body.connectionId) {
    return new Response(JSON.stringify({ error: 'connectionId is required' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const deps = await createAdsDepsForRequest(locals);
  const ads = await makeAcquisitionAds(deps);
  await ads.funnelBindingRepo.unbind(funnelId, body.connectionId);
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json' } });
};
