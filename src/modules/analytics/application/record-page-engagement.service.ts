import { createLogger } from '@/lib/logger';
import { parseEngagementPayload } from '../domain/engagement-payload';
import type { ActivityEvent } from '../domain/activity-event';
import type { PageEngagementRow, PageEngagementStorePort } from './ports/outbound';

const logger = createLogger('analytics:page-engagement');

export function buildEngagementRow(event: ActivityEvent): PageEngagementRow | null {
  if (event.kind !== 'page_leave') return null;
  if (!event.pageId || !event.sessionId || !event.visitorId) return null;

  const payload = parseEngagementPayload(event.metadata);
  if (!payload) return null;

  return {
    visitorId: event.visitorId,
    sessionId: event.sessionId,
    pageId: event.pageId,
    funnelId: event.funnelId,
    stepId: event.stepId,
    dwellMs: payload.dwellMs,
    activeMs: payload.activeMs,
    maxScrollPct: payload.maxScrollPct,
    exitScrollPct: payload.exitScrollPct,
    viewportPct: payload.viewportPct,
    dwellByDepth: payload.dwellByDepth,
    interactions: payload.interactions,
    occurredAt: event.occurredAt,
  };
}

export class RecordPageEngagementService {
  constructor(private readonly deps: { store: PageEngagementStorePort }) {}

  async record(event: ActivityEvent): Promise<void> {
    try {
      const row = buildEngagementRow(event);
      if (!row) return;
      await this.deps.store.upsertEngagement(row);
    } catch (error) {
      logger.error('failed to record page engagement', { error, pageId: event.pageId });
    }
  }
}
