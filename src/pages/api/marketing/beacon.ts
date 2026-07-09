import type { APIRoute } from 'astro';
import type { AttributionIngestPort } from '@/modules/acquisition-ads/application/ports/inbound';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';

export async function handleBeacon(request: Request, ingest: AttributionIngestPort): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }
  if (!body?.sessionId || !body?.landingUrl) {
    return new Response('missing sessionId/landingUrl', { status: 400 });
  }
  await ingest.capture({
    sessionId: body.sessionId,
    visitorId: body.visitorId,
    query: body.query ?? {},
    fbp: body.fbp,
    ga: body.ga,
    landingUrl: body.landingUrl,
    landingTimestampMs: body.landingTimestampMs ?? Date.now(),
    transientIp: request.headers.get('cf-connecting-ip') ?? undefined,
    transientUserAgent: request.headers.get('user-agent') ?? undefined,
  });
  return new Response(null, { status: 204 });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const ads = await makeAcquisitionAds(await createAdsDepsForRequest(locals));
  return handleBeacon(request, ads.captureAttribution);
};
