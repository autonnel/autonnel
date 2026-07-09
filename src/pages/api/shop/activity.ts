import type { APIRoute } from 'astro';
import { createLogger } from '../../../lib/logger';
import { makeActivityIngest } from '../../../composition/analytics/make-activity';
import type { RawActivityEvent } from '../../../modules/analytics/domain/activity-event';

export const prerender = false;

const logger = createLogger('analytics:activity');

const ACTIVITY_FIELDS = [
  'kind',
  'visitorId',
  'sessionId',
  'funnelId',
  'pageId',
  'stepId',
  'url',
  'referrer',
  'metadata',
  'occurredAt',
] as const;

function toRawEvent(value: unknown): RawActivityEvent {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const event: Record<string, unknown> = {};
  for (const field of ACTIVITY_FIELDS) event[field] = source[field];
  return event as RawActivityEvent;
}

function extractEvents(payload: unknown): RawActivityEvent[] {
  if (payload && typeof payload === 'object' && Array.isArray((payload as { events?: unknown }).events)) {
    return (payload as { events: unknown[] }).events.map(toRawEvent);
  }
  if (payload && typeof payload === 'object') return [toRawEvent(payload)];
  return [];
}

// A tracking beacon must never surface a 500: always return 2xx.
export const POST: APIRoute = async (ctx) => {
  try {
    const payload = await ctx.request.json();
    const events = extractEvents(payload);
    const { stored } = await makeActivityIngest().recordActivity({ events });
    return new Response(JSON.stringify({ stored }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    logger.error('activity ingest failed', { error: err });
    return new Response(JSON.stringify({ stored: 0 }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    });
  }
};
