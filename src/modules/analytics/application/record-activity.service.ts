import { createLogger } from '@/lib/logger';
import { isCustomKind } from '@/lib/analytics/custom-event-name';
import { normalizeActivityEvent, type RawActivityEvent } from '../domain/activity-event';
import type { ActivityEvent } from '../domain/activity-event';
import type { ActivityEventRow, ActivityEventStorePort } from './ports/outbound';
import type { ActivityIngestPort } from './ports/inbound';

const MAX_BATCH = 50;
// A legitimate page view sends one leave beacon per (visitor, session, page); five is generous
// headroom without letting a public unauthenticated batch fan out into 50+ sequential queries.
const MAX_ENGAGEMENT_WRITES = 5;
// The custom: namespace is caller-defined, so one page could otherwise mint an unbounded
// number of distinct kinds. Matches the tracker's per-page cap: a batch is a subset of one
// page's events, so a lower value here would drop events a legitimate page really sent.
const MAX_CUSTOM_KINDS_PER_BATCH = 20;

const logger = createLogger('analytics:record-activity');

export interface RecordActivityDeps {
  store: ActivityEventStorePort;
  engagement?: { record(event: ActivityEvent): Promise<void> };
}

function engagementKey(row: ActivityEventRow): string | null {
  if (row.kind !== 'page_leave' || !row.visitorId || !row.sessionId || !row.pageId) return null;
  return `${row.visitorId}:${row.sessionId}:${row.pageId}`;
}

// The beacon is cumulative, so when a batch carries several leave events for the same
// (visitor, session, page), only the last one already contains everything the earlier ones saw.
function dedupeEngagementCandidates(rows: ReadonlyArray<ActivityEventRow>): ActivityEventRow[] {
  const byKey = new Map<string, ActivityEventRow>();
  for (const row of rows) {
    const key = engagementKey(row);
    if (key) byKey.set(key, row);
  }
  return [...byKey.values()];
}

export class RecordActivityService implements ActivityIngestPort {
  constructor(private readonly deps: RecordActivityDeps) {}

  async recordActivity(input: { events: RawActivityEvent[] }): Promise<{ stored: number }> {
    const rows: ActivityEventRow[] = [];
    for (const raw of input.events.slice(0, MAX_BATCH)) {
      try {
        rows.push(normalizeActivityEvent(raw));
      } catch {
        // Best-effort log: a single invalid event never fails the batch.
      }
    }
    if (rows.length === 0) return { stored: 0 };
    const kept = capCustomKinds(rows);
    if (kept.length < rows.length) {
      logger.warn('custom event kinds truncated', {
        dropped: rows.length - kept.length,
        cap: MAX_CUSTOM_KINDS_PER_BATCH,
      });
    }
    if (kept.length === 0) return { stored: 0 };
    await this.deps.store.appendActivity(kept);
    const engagement = this.deps.engagement;
    if (engagement) {
      const candidates = dedupeEngagementCandidates(kept);
      const bounded = candidates.slice(0, MAX_ENGAGEMENT_WRITES);
      if (candidates.length > MAX_ENGAGEMENT_WRITES) {
        logger.warn('engagement fan-out truncated', { dropped: candidates.length - MAX_ENGAGEMENT_WRITES });
      }
      for (const row of bounded) await engagement.record(row);
    }
    return { stored: kept.length };
  }
}

function capCustomKinds(rows: ReadonlyArray<ActivityEventRow>): ActivityEventRow[] {
  const seen = new Set<string>();
  const kept: ActivityEventRow[] = [];
  for (const row of rows) {
    if (!isCustomKind(row.kind)) {
      kept.push(row);
      continue;
    }
    if (!seen.has(row.kind)) {
      if (seen.size >= MAX_CUSTOM_KINDS_PER_BATCH) continue;
      seen.add(row.kind);
    }
    kept.push(row);
  }
  return kept;
}
