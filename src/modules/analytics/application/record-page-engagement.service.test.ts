import { describe, it, expect, vi } from 'vitest';
import { DEPTH_BANDS } from '@/lib/stats/engagement';
import type { ActivityEvent } from '../domain/activity-event';
import { RecordPageEngagementService, buildEngagementRow } from './record-page-engagement.service';
import type { PageEngagementRow, PageEngagementStorePort } from './ports/outbound';

const OCCURRED = new Date('2026-09-01T00:00:00Z');

function event(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    kind: 'page_leave',
    visitorId: 'v1',
    sessionId: 's1',
    funnelId: 'f1',
    pageId: 'p1',
    stepId: 'checkout',
    url: 'https://shop.example/lp',
    referrer: null,
    metadata: {
      timeOnPageMs: 30_000,
      engagement: {
        activeMs: 12_000,
        maxScrollPct: 60,
        exitScrollPct: 55,
        viewportPct: 5,
        dwellByDepth: new Array(DEPTH_BANDS).fill(1),
        interactions: ['3:cta'],
      },
    },
    occurredAt: OCCURRED,
    ...overrides,
  };
}

describe('buildEngagementRow', () => {
  it('shapes a complete leave event into a row', () => {
    expect(buildEngagementRow(event())).toEqual<PageEngagementRow>({
      visitorId: 'v1',
      sessionId: 's1',
      pageId: 'p1',
      funnelId: 'f1',
      stepId: 'checkout',
      dwellMs: 30_000,
      activeMs: 12_000,
      maxScrollPct: 60,
      exitScrollPct: 55,
      viewportPct: 5,
      dwellByDepth: new Array(DEPTH_BANDS).fill(1),
      interactions: ['3:cta'],
      occurredAt: OCCURRED,
    });
  });

  it('skips events that are not a page leave', () => {
    expect(buildEngagementRow(event({ kind: 'page_view' }))).toBeNull();
  });

  it('skips an event with no page to attribute the measurement to', () => {
    // The uniqueness key cannot exist without a pageId.
    expect(buildEngagementRow(event({ pageId: null }))).toBeNull();
  });

  it('skips an event with no session', () => {
    expect(buildEngagementRow(event({ sessionId: null }))).toBeNull();
  });

  it('skips an event with no usable dwell', () => {
    expect(buildEngagementRow(event({ metadata: { engagement: {} } }))).toBeNull();
    expect(buildEngagementRow(event({ metadata: null }))).toBeNull();
  });
});

describe('RecordPageEngagementService', () => {
  it('upserts a row for a valid leave event', async () => {
    const store: PageEngagementStorePort = { upsertEngagement: vi.fn().mockResolvedValue(undefined) };
    await new RecordPageEngagementService({ store }).record(event());
    expect(store.upsertEngagement).toHaveBeenCalledTimes(1);
  });

  it('writes nothing for an event that yields no row', async () => {
    const store: PageEngagementStorePort = { upsertEngagement: vi.fn().mockResolvedValue(undefined) };
    await new RecordPageEngagementService({ store }).record(event({ kind: 'page_view' }));
    expect(store.upsertEngagement).not.toHaveBeenCalled();
  });

  it('swallows a store failure', async () => {
    // Fire and forget: an engagement write failure must never cost the caller
    // its activity row.
    const store: PageEngagementStorePort = {
      upsertEngagement: vi.fn().mockRejectedValue(new Error('db down')),
    };
    await expect(new RecordPageEngagementService({ store }).record(event())).resolves.toBeUndefined();
  });
});
