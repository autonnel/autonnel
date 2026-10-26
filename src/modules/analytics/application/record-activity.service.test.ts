import { describe, it, expect, vi, beforeEach } from 'vitest';

const { logger } = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));
vi.mock('@/lib/logger', () => ({ createLogger: () => logger }));

import { RecordActivityService } from './record-activity.service';
import type { ActivityEventStorePort } from './ports/outbound';
import type { ActivityEvent, RawActivityEvent } from '../domain/activity-event';

function leaveEvent(overrides: Partial<RawActivityEvent> = {}): RawActivityEvent {
  return {
    kind: 'page_leave',
    visitorId: 'v1',
    sessionId: 's1',
    pageId: 'p1',
    occurredAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

function makeStore() {
  const appended: unknown[] = [];
  const store: ActivityEventStorePort = {
    async appendActivity(events) {
      appended.push(...events);
    },
  };
  return { store, appended };
}

describe('RecordActivityService engagement fan-out', () => {
  beforeEach(() => {
    logger.warn.mockClear();
  });

  it('writes once when a batch carries several leave events for the same key, keeping the last', async () => {
    const { store, appended } = makeStore();
    const recorded: ActivityEvent[] = [];
    const engagement = { record: vi.fn(async (e: ActivityEvent) => void recorded.push(e)) };
    const service = new RecordActivityService({ store, engagement });

    await service.recordActivity({
      events: [
        leaveEvent({ occurredAt: '2026-09-01T00:00:00Z' }),
        leaveEvent({ occurredAt: '2026-09-01T00:00:05Z' }),
      ],
    });

    expect(engagement.record).toHaveBeenCalledTimes(1);
    expect(recorded[0].occurredAt.toISOString()).toBe('2026-09-01T00:00:05.000Z');
    expect(appended.length).toBe(2);
  });

  it('caps distinct keys at the engagement write limit and logs one warning', async () => {
    const { store, appended } = makeStore();
    const engagement = { record: vi.fn(async () => {}) };
    const service = new RecordActivityService({ store, engagement });

    const events = Array.from({ length: 8 }, (_, i) => leaveEvent({ pageId: `p${i}`, sessionId: `s${i}` }));
    await service.recordActivity({ events });

    expect(engagement.record).toHaveBeenCalledTimes(5);
    expect(appended.length).toBe(8);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('engagement fan-out truncated', { dropped: 3 });
  });

  it('does not warn when the batch is within the cap', async () => {
    const { store } = makeStore();
    const engagement = { record: vi.fn(async () => {}) };
    const service = new RecordActivityService({ store, engagement });

    const events = Array.from({ length: 3 }, (_, i) => leaveEvent({ pageId: `p${i}`, sessionId: `s${i}` }));
    await service.recordActivity({ events });

    expect(engagement.record).toHaveBeenCalledTimes(3);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('writes nothing for a batch of non-leave events', async () => {
    const { store, appended } = makeStore();
    const engagement = { record: vi.fn(async () => {}) };
    const service = new RecordActivityService({ store, engagement });

    await service.recordActivity({
      events: [leaveEvent({ kind: 'page_view' }), leaveEvent({ kind: 'checkout_view' })],
    });

    expect(engagement.record).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(appended.length).toBe(2);
  });

  it('appendActivity still receives every valid row, unaffected by the engagement cap', async () => {
    const { store, appended } = makeStore();
    const engagement = { record: vi.fn(async () => {}) };
    const service = new RecordActivityService({ store, engagement });

    const events = Array.from({ length: 10 }, (_, i) => leaveEvent({ pageId: `p${i}`, sessionId: `s${i}` }));
    const result = await service.recordActivity({ events });

    expect(result.stored).toBe(10);
    expect(appended.length).toBe(10);
  });
});

describe('RecordActivityService custom kind cardinality cap', () => {
  beforeEach(() => {
    logger.warn.mockClear();
  });

  const raw = (kind: string): RawActivityEvent => ({
    kind,
    visitorId: 'v1',
    occurredAt: '2026-09-02T00:00:00Z',
  });

  const kindsOf = (appended: unknown[]) => appended.map((r) => (r as { kind: string }).kind);

  it('keeps the first 20 distinct custom kinds and drops the rest', async () => {
    const { store, appended } = makeStore();
    const service = new RecordActivityService({ store });

    const { stored } = await service.recordActivity({
      events: Array.from({ length: 25 }, (_, i) => raw(`custom:e${i}`)),
    });

    expect(stored).toBe(20);
    expect(kindsOf(appended)).toContain('custom:e19');
    expect(kindsOf(appended)).not.toContain('custom:e20');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('does not count repeats of an already-seen custom kind against the cap', async () => {
    const { store } = makeStore();
    const service = new RecordActivityService({ store });

    const { stored } = await service.recordActivity({
      events: [
        ...Array.from({ length: 20 }, (_, i) => raw(`custom:e${i}`)),
        raw('custom:e0'),
        raw('custom:e0'),
      ],
    });

    expect(stored).toBe(22);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('never drops built-in kinds, however many custom kinds arrive', async () => {
    const { store, appended } = makeStore();
    const service = new RecordActivityService({ store });

    await service.recordActivity({
      events: [...Array.from({ length: 25 }, (_, i) => raw(`custom:e${i}`)), raw('page_view')],
    });

    expect(kindsOf(appended)).toContain('page_view');
  });
});
