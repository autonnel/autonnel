export interface ActivityEventRow {
  kind: string;
  visitorId: string;
  sessionId: string | null;
  funnelId: string | null;
  pageId: string | null;
  stepId: string | null;
  url: string | null;
  referrer: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: Date;
}

export interface ActivityEventStorePort {
  appendActivity(events: ReadonlyArray<ActivityEventRow>): Promise<void>;
}

export interface PageEngagementRow {
  visitorId: string;
  sessionId: string;
  pageId: string;
  funnelId: string | null;
  stepId: string | null;
  dwellMs: number;
  activeMs: number | null;
  maxScrollPct: number | null;
  exitScrollPct: number | null;
  viewportPct: number | null;
  dwellByDepth: number[];
  interactions: string[];
  occurredAt: Date;
}

export interface PageEngagementStorePort {
  upsertEngagement(row: PageEngagementRow): Promise<void>;
}
