import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';
import {
  INTERNAL_TRIGGERS,
  type InternalTrigger,
  type MappingRule,
} from '@/modules/acquisition-ads/domain/mapping/event-mapping-profile';

interface UiMapping {
  internalEvent: string;
  platformEvent: string;
}

const INTERNAL_EVENT_DEFS: Record<InternalTrigger, { label: string; description: string }> = {
  PageView: { label: 'Page View', description: 'Visitor viewed a page' },
  CheckoutView: { label: 'Checkout View', description: 'Visitor reached checkout' },
  InitiatePayment: { label: 'Initiate Payment', description: 'Visitor started payment' },
  Purchase: { label: 'Purchase', description: 'Order completed' },
};

const PLATFORM_EVENTS: Record<'FACEBOOK' | 'TIKTOK', { id: string; label: string }[]> = {
  FACEBOOK: [
    { id: 'PageView', label: 'PageView' },
    { id: 'ViewContent', label: 'ViewContent' },
    { id: 'AddToCart', label: 'AddToCart' },
    { id: 'InitiateCheckout', label: 'InitiateCheckout' },
    { id: 'AddPaymentInfo', label: 'AddPaymentInfo' },
    { id: 'Purchase', label: 'Purchase' },
    { id: 'Lead', label: 'Lead' },
    { id: 'CompleteRegistration', label: 'CompleteRegistration' },
  ],
  TIKTOK: [
    { id: 'ViewContent', label: 'ViewContent' },
    { id: 'AddToCart', label: 'AddToCart' },
    { id: 'InitiateCheckout', label: 'InitiateCheckout' },
    { id: 'AddPaymentInfo', label: 'AddPaymentInfo' },
    { id: 'PlaceAnOrder', label: 'PlaceAnOrder' },
    { id: 'CompletePayment', label: 'CompletePayment' },
    { id: 'ClickButton', label: 'ClickButton' },
  ],
};

const PLATFORM_DEFAULTS: Record<'FACEBOOK' | 'TIKTOK', UiMapping[]> = {
  FACEBOOK: [
    { internalEvent: 'PageView', platformEvent: 'PageView' },
    { internalEvent: 'CheckoutView', platformEvent: 'InitiateCheckout' },
    { internalEvent: 'InitiatePayment', platformEvent: 'AddPaymentInfo' },
    { internalEvent: 'Purchase', platformEvent: 'Purchase' },
  ],
  TIKTOK: [
    { internalEvent: 'PageView', platformEvent: 'ViewContent' },
    { internalEvent: 'CheckoutView', platformEvent: 'InitiateCheckout' },
    { internalEvent: 'InitiatePayment', platformEvent: 'AddPaymentInfo' },
    { internalEvent: 'Purchase', platformEvent: 'CompletePayment' },
  ],
};

function platformKey(platform: string): 'FACEBOOK' | 'TIKTOK' {
  const p = platform.toUpperCase();
  if (p === 'TIKTOK') return 'TIKTOK';
  return 'FACEBOOK';
}

const TRIGGER_SET = new Set<string>(INTERNAL_TRIGGERS);

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
  const key = platformKey(conn.platform);

  const profile = await ads.mappingRepo.findActive();
  const customMappings: UiMapping[] = profile
    ? profile.rules
        .filter((r) => r.enabled)
        .map((r) => ({ internalEvent: r.trigger, platformEvent: r.platformEventName }))
    : [];

  const internalEvents = INTERNAL_TRIGGERS.map((trigger) => ({
    id: trigger,
    label: INTERNAL_EVENT_DEFS[trigger].label,
    description: INTERNAL_EVENT_DEFS[trigger].description,
  }));

  return new Response(JSON.stringify({
    supported: true,
    mappings: customMappings,
    customMappings,
    defaults: PLATFORM_DEFAULTS[key],
    internalEvents,
    platformEvents: PLATFORM_EVENTS[key],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  await requireFeature('MARKETING');
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'ID is required' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  let body: { mappings?: UiMapping[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  if (!Array.isArray(body.mappings)) {
    return new Response(JSON.stringify({ error: 'mappings must be an array' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  const deps = await createAdsDepsForRequest(locals);
  const ads = await makeAcquisitionAds(deps);
  const conn = await ads.connectionRepo.findById(id);
  if (!conn) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  }

  const destination = conn.destinations.find((d) => d.isDefault) ?? conn.destinations[0];
  if (!destination) {
    return new Response(JSON.stringify({ error: 'connection has no destination' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  const rules: MappingRule[] = body.mappings
    .filter((m) => TRIGGER_SET.has(m.internalEvent) && !!m.platformEvent)
    .map((m) => ({
      trigger: m.internalEvent as InternalTrigger,
      platformEventName: m.platformEvent,
      destinationId: destination.id,
      enabled: true,
    }));

  try {
    const result = await ads.configureMapping.configureMapping({ rules });
    return new Response(JSON.stringify({ mappings: body.mappings, version: result.version }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to save event mappings' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
};
