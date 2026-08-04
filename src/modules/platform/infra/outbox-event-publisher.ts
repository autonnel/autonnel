// Write the envelope in the SAME Prisma tx as the aggregate change to avoid dual-write loss on isolate teardown — there is no in-process broker on Workers.
import type { DomainEventEnvelope, EventCorrelation, EventPublisherPort } from "../../shared-kernel";

export class OutboxEventPublisher implements EventPublisherPort {
  constructor(private readonly db: any) {}

  async publish(event: DomainEventEnvelope): Promise<void> {
    await this.db.jobOutbox.create({
      data: {
        tenantId: event.tenantId, eventId: event.eventId, type: event.type,
        payload: event.payload as object, correlation: event.correlation as object, occurredAt: event.occurredAt,
      },
    });
  }

  async publishMany(events: DomainEventEnvelope[]): Promise<void> {
    for (const e of events) await this.publish(e);
  }
}

export const MAX_OUTBOX_ATTEMPTS = 10;
const RETRY_BASE_MS = 30_000;
const RETRY_CAP_MS = 60 * 60_000;

// First retry is immediate so the inline checkout drain can recover a transient blip within the same
// request; later retries back off exponentially up to the cap.
export function outboxBackoffMs(attemptCount: number): number {
  if (attemptCount <= 1) return 0;
  return Math.min(RETRY_BASE_MS * 2 ** (attemptCount - 2), RETRY_CAP_MS);
}

interface OutboxRow {
  eventId: string;
  type: string;
  tenantId: string;
  occurredAt: Date;
  payload: unknown;
  correlation: EventCorrelation;
  attemptCount: number;
  claimedAt?: Date | null;
}

export class OutboxDrainService {
  constructor(
    private readonly db: any,
    private readonly deliver: (event: DomainEventEnvelope) => Promise<void>,
    private readonly batchSize = 100,
    private readonly clock: () => Date = () => new Date(),
    private readonly maxAttempts = MAX_OUTBOX_ATTEMPTS,
    private readonly claimLeaseMs = 120_000,
  ) {}

  // The per-checkout inline drain and the scheduled drain run concurrently, so selection alone is
  // not ownership: each row must be claimed with a conditional update before any handler or
  // notification fan-out runs, or Slack/webhook destinations get contacted twice. The claim is
  // leased so an isolate that dies mid-delivery does not strand the row forever.
  async drain(): Promise<number> {
    const now = this.clock();
    const leaseCutoff = new Date(now.getTime() - this.claimLeaseMs);
    const rows: OutboxRow[] = await this.db.jobOutbox.findMany({
      where: {
        publishedAt: null,
        deadLetteredAt: null,
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        AND: [{ OR: [{ claimedAt: null }, { claimedAt: { lt: leaseCutoff } }] }],
      },
      orderBy: { createdAt: "asc" },
      take: this.batchSize,
    });
    let delivered = 0;
    for (const r of rows) {
      const claim = await this.db.jobOutbox.updateMany({
        where: {
          eventId: r.eventId,
          publishedAt: null,
          OR: [{ claimedAt: null }, { claimedAt: { lt: leaseCutoff } }],
        },
        data: { claimedAt: now },
      });
      if (claim.count !== 1) continue; // another isolate owns this row

      try {
        await this.deliver({
          eventId: r.eventId, type: r.type, tenantId: r.tenantId, occurredAt: r.occurredAt,
          payload: r.payload, correlation: r.correlation,
        });
        await this.db.jobOutbox.update({
          where: { eventId: r.eventId },
          data: { publishedAt: now, nextRetryAt: null, failedAt: null, lastError: null },
        });
        delivered++;
      } catch (error) {
        await this.recordFailure(r, error, now);
      }
    }
    return delivered;
  }

  private async recordFailure(row: OutboxRow, error: unknown, now: Date): Promise<void> {
    const attemptCount = (row.attemptCount ?? 0) + 1;
    const lastError = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
    const deadLettered = attemptCount >= this.maxAttempts;
    await this.db.jobOutbox.update({
      where: { eventId: row.eventId },
      data: {
        attemptCount,
        failedAt: now,
        lastError,
        // Release the claim so the scheduled retry can pick the row up again.
        claimedAt: null,
        deadLetteredAt: deadLettered ? now : null,
        nextRetryAt: deadLettered ? null : new Date(now.getTime() + outboxBackoffMs(attemptCount)),
      },
    });
  }
}
