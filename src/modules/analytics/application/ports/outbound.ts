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
