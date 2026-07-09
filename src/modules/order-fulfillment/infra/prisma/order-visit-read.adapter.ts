import type { OrderVisitReadPort, OrderVisitView } from "../../application/order-dashboard-read-model";

interface EventRow {
  kind: string;
  stepId: string | null;
  url: string | null;
  occurredAt: Date | string;
}
interface PrismaLike {
  userActivityEvent: {
    findMany(args: unknown): Promise<EventRow[]>;
    count(args: unknown): Promise<number>;
  };
}

export class PrismaOrderVisitReadAdapter implements OrderVisitReadPort {
  constructor(private readonly db: PrismaLike) {}

  // `id` is the order's checkout/tracking sessionId (order.attribution.sessionId). Match raw activity
  // events by sessionId; if that session left no events, fall back to treating it as a visitorId so
  // older orders that only carried an anid still resolve a visit history.
  async bySession(
    id: string,
    limit: number,
  ): Promise<{ visits: OrderVisitView[]; total: number }> {
    let where: Record<string, unknown> = { sessionId: id };
    let total = await this.db.userActivityEvent.count({ where });
    if (total === 0) {
      where = { visitorId: id };
      total = await this.db.userActivityEvent.count({ where });
      if (total === 0) return { visits: [], total: 0 };
    }
    const events = await this.db.userActivityEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: limit,
      select: { kind: true, stepId: true, url: true, occurredAt: true },
    });
    const visits: OrderVisitView[] = events.map((e) => ({
      url: e.url ?? e.stepId ?? "",
      kind: e.kind,
      occurredAt: toIso(e.occurredAt),
    }));
    return { visits, total };
  }
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
