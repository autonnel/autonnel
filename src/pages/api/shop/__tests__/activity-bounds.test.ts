import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

// The real domain normalizer runs; only persistence is faked, so the budgets under test are the
// production ones.
vi.mock('@/composition/analytics/make-activity', () => ({
  makeActivityIngest: () => ({
    recordActivity: async ({ events }: { events: Record<string, unknown>[] }) => {
      const { normalizeActivityEvent } = await import('@/modules/analytics/domain/activity-event');
      h.rows = [];
      for (const raw of events.slice(0, 50)) {
        try {
          h.rows.push(normalizeActivityEvent(raw as never) as unknown as Record<string, unknown>);
        } catch {
          /* invalid events are dropped, as in production */
        }
      }
      return { stored: h.rows.length };
    },
  }),
}));

import { POST } from '../activity';
import { METADATA_MAX_BYTES, ID_MAX_LENGTH } from '@/modules/analytics/domain/activity-event';

function ctx(body: string) {
  return {
    request: new Request('http://shop.test/api/shop/activity', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }),
    locals: {},
    params: {},
  } as never;
}

beforeEach(() => {
  h.rows = [];
});

describe('POST /api/shop/activity — input bounds', () => {
  it('rejects a body over the byte cap without storing anything', async () => {
    const huge = JSON.stringify({
      kind: 'page_view',
      visitorId: 'v1',
      metadata: { blob: 'x'.repeat(200_000) },
    });
    const res = await POST(ctx(huge));
    expect(res.status).toBe(413);
    expect(h.rows).toHaveLength(0);
  });

  it('drops oversized metadata but keeps the event', async () => {
    const body = JSON.stringify({
      kind: 'page_view',
      visitorId: 'v1',
      metadata: { blob: 'y'.repeat(METADATA_MAX_BYTES + 100) },
    });
    const res = await POST(ctx(body));
    expect(res.status).toBe(202);
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0].metadata).toBeNull();
  });

  it('drops metadata nested past the depth budget', async () => {
    const body = JSON.stringify({
      kind: 'page_view',
      visitorId: 'v1',
      metadata: { a: { b: { c: { d: { e: 1 } } } } },
    });
    await POST(ctx(body));
    expect(h.rows[0].metadata).toBeNull();
  });

  it('drops metadata with too many keys', async () => {
    const meta: Record<string, number> = {};
    for (let i = 0; i < 100; i++) meta[`k${i}`] = i;
    const body = JSON.stringify({ kind: 'page_view', visitorId: 'v1', metadata: meta });
    await POST(ctx(body));
    expect(h.rows[0].metadata).toBeNull();
  });

  it('keeps metadata within all budgets', async () => {
    const body = JSON.stringify({ kind: 'page_view', visitorId: 'v1', metadata: { a: 1, b: 'ok' } });
    await POST(ctx(body));
    expect(h.rows[0].metadata).toEqual({ a: 1, b: 'ok' });
  });

  it('drops an event whose visitorId exceeds the id cap', async () => {
    const body = JSON.stringify({ kind: 'page_view', visitorId: 'z'.repeat(ID_MAX_LENGTH + 1) });
    const res = await POST(ctx(body));
    expect(res.status).toBe(202);
    expect(h.rows).toHaveLength(0);
  });

  it('truncates optional identifiers to the id cap', async () => {
    const body = JSON.stringify({
      kind: 'page_view',
      visitorId: 'v1',
      sessionId: 's'.repeat(ID_MAX_LENGTH + 50),
    });
    await POST(ctx(body));
    expect((h.rows[0].sessionId as string).length).toBe(ID_MAX_LENGTH);
  });
});
