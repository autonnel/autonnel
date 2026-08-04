import type { APIRoute } from 'astro';
import type { AttributionIngestPort } from '@/modules/acquisition-ads/application/ports/inbound';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';

export const BEACON_MAX_FIELD_LENGTH = 512;
export const BEACON_MAX_URL_LENGTH = 2048;
export const BEACON_MAX_QUERY_KEYS = 32;

function bounded(value: unknown, max: number): string | undefined {
  return typeof value === 'string' ? value.slice(0, max) : undefined;
}

// Anonymous by design (it runs before any checkout session exists), so every field is
// length-bounded: the endpoint must not let one request buy unbounded attribution storage.
function boundedQuery(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > BEACON_MAX_QUERY_KEYS) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (typeof v !== 'string') continue;
    out[k.slice(0, BEACON_MAX_FIELD_LENGTH)] = v.slice(0, BEACON_MAX_FIELD_LENGTH);
  }
  return out;
}

export async function handleBeacon(request: Request, ingest: AttributionIngestPort): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }
  const sessionId = bounded(body?.sessionId, BEACON_MAX_FIELD_LENGTH);
  const landingUrl = bounded(body?.landingUrl, BEACON_MAX_URL_LENGTH);
  if (!sessionId || !landingUrl) {
    return new Response('missing sessionId/landingUrl', { status: 400 });
  }
  await ingest.capture({
    sessionId,
    visitorId: bounded(body.visitorId, BEACON_MAX_FIELD_LENGTH),
    query: boundedQuery(body.query),
    fbp: bounded(body.fbp, BEACON_MAX_FIELD_LENGTH),
    ga: bounded(body.ga, BEACON_MAX_FIELD_LENGTH),
    landingUrl,
    landingTimestampMs: typeof body.landingTimestampMs === 'number' ? body.landingTimestampMs : Date.now(),
    transientIp: request.headers.get('cf-connecting-ip') ?? undefined,
    transientUserAgent: bounded(request.headers.get('user-agent'), BEACON_MAX_FIELD_LENGTH),
  });
  return new Response(null, { status: 204 });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const ads = await makeAcquisitionAds(await createAdsDepsForRequest(locals));
  return handleBeacon(request, ads.captureAttribution);
};
