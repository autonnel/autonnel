import type { APIRoute } from 'astro';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';

export const GET: APIRoute = async ({ params, url, locals }) => {
  const { orderId } = params;
  if (!orderId) {
    return new Response(JSON.stringify({ error: 'Order ID is required' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const eventId = url.searchParams.get('eventId');
  const deps = await createAdsDepsForRequest(locals);
  const ads = await makeAcquisitionAds(deps);
  const connections = await ads.connectionRepo.list();
  const postbackRows: { connectionId: string; platform: string; status: string; attempts: number }[] = [];
  for (const c of connections) {
    for (const d of c.destinations) {
      const pb = eventId
        ? await ads.postbackRepo.findByDedup(d.id, eventId)
        : null;
      if (pb) {
        postbackRows.push({
          connectionId: c.id,
          platform: c.platform,
          status: pb.status,
          attempts: pb.attemptCount,
        });
      }
    }
  }
  return new Response(JSON.stringify(postbackRows), { status: 200, headers: { 'content-type': 'application/json' } });
};
