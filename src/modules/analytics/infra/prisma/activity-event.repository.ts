import type { ActivityEventRow, ActivityEventStorePort } from '../../application/ports/outbound';

type ActivityDelegate = {
  createMany?: (args: unknown) => Promise<unknown>;
  create: (args: unknown) => Promise<unknown>;
};

export class PrismaActivityEventStore implements ActivityEventStorePort {
  constructor(private readonly delegate: ActivityDelegate) {}

  async appendActivity(events: ReadonlyArray<ActivityEventRow>): Promise<void> {
    if (events.length === 0) return;
    const data = events.map((e) => this.toData(e));
    // tenantId is injected by the tenant prisma extension on create/createMany.
    if (this.delegate.createMany) {
      await this.delegate.createMany({ data } as never);
      return;
    }
    for (const row of data) {
      await this.delegate.create({ data: row } as never);
    }
  }

  private toData(e: ActivityEventRow): Record<string, unknown> {
    return {
      visitorId: e.visitorId,
      sessionId: e.sessionId,
      funnelId: e.funnelId,
      pageId: e.pageId,
      stepId: e.stepId,
      kind: e.kind,
      url: e.url,
      referrer: e.referrer,
      metadata: e.metadata ?? undefined,
      occurredAt: e.occurredAt,
    };
  }
}
