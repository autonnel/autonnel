import { describe, it, expect, vi } from "vitest";
import { OutboxDrainService, outboxBackoffMs } from "./outbox-event-publisher";
import type { DomainEventEnvelope } from "../../shared-kernel";

interface Row {
  eventId: string;
  type: string;
  tenantId: string;
  occurredAt: Date;
  payload: unknown;
  correlation: unknown;
  attemptCount: number;
  publishedAt: Date | null;
  failedAt: Date | null;
  nextRetryAt: Date | null;
  lastError: string | null;
  deadLetteredAt: Date | null;
  createdAt: Date;
}

function makeRow(eventId: string, createdAt: Date): Row {
  return {
    eventId, type: "payment.captured", tenantId: "t1", occurredAt: createdAt,
    payload: { saleRef: "s1" }, correlation: { saleRef: "s1" }, attemptCount: 0,
    publishedAt: null, failedAt: null, nextRetryAt: null, lastError: null, deadLetteredAt: null, createdAt,
  };
}

// In-memory stand-in mirroring the exact query/update shapes OutboxDrainService issues.
function makeFakeDb(rows: Row[], clock: () => Date) {
  return {
    jobOutbox: {
      findMany: vi.fn(async ({ take }: { take: number }) => {
        const now = clock();
        return rows
          .filter((r) => r.publishedAt === null && r.deadLetteredAt === null && (r.nextRetryAt === null || r.nextRetryAt <= now))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .slice(0, take)
          .map((r) => ({ ...r }));
      }),
      update: vi.fn(async ({ where, data }: { where: { eventId: string }; data: Partial<Row> }) => {
        const r = rows.find((x) => x.eventId === where.eventId)!;
        Object.assign(r, data);
        return { ...r };
      }),
    },
  };
}

describe("outboxBackoffMs", () => {
  it("retries the first failure immediately then backs off, capped", () => {
    expect(outboxBackoffMs(1)).toBe(0);
    expect(outboxBackoffMs(2)).toBe(30_000);
    expect(outboxBackoffMs(3)).toBe(60_000);
    expect(outboxBackoffMs(4)).toBe(120_000);
    expect(outboxBackoffMs(20)).toBe(60 * 60_000);
  });
});

describe("OutboxDrainService at-least-once", () => {
  it("publishes on success and clears retry bookkeeping", async () => {
    const rows = [makeRow("e1", new Date(0))];
    const now = new Date("2026-01-01T00:00:00Z");
    const db = makeFakeDb(rows, () => now);
    const deliver = vi.fn(async () => {});
    const svc = new OutboxDrainService(db, deliver, 100, () => now);

    const delivered = await svc.drain();

    expect(delivered).toBe(1);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(rows[0].publishedAt).toEqual(now);
    expect(rows[0].nextRetryAt).toBeNull();
  });

  it("does NOT mark published when the handler fails; schedules a retry", async () => {
    const rows = [makeRow("e1", new Date(0))];
    const now = new Date("2026-01-01T00:00:00Z");
    const db = makeFakeDb(rows, () => now);
    const deliver = vi.fn(async () => {
      throw new Error("transient downstream failure");
    });
    const svc = new OutboxDrainService(db, deliver, 100, () => now);

    const delivered = await svc.drain();

    expect(delivered).toBe(0);
    expect(rows[0].publishedAt).toBeNull();
    expect(rows[0].attemptCount).toBe(1);
    expect(rows[0].failedAt).toEqual(now);
    expect(rows[0].lastError).toContain("transient downstream failure");
    // attempt 1 => immediate retry eligibility
    expect(rows[0].nextRetryAt).toEqual(now);
    expect(rows[0].deadLetteredAt).toBeNull();
  });

  it("redelivers a transiently-failed event until it succeeds (at-least-once)", async () => {
    const rows = [makeRow("e1", new Date(0))];
    let t = new Date("2026-01-01T00:00:00Z").getTime();
    const clock = () => new Date(t);
    const db = makeFakeDb(rows, clock);
    const deliver = vi
      .fn<(e: DomainEventEnvelope) => Promise<void>>()
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce(undefined);
    const svc = new OutboxDrainService(db, deliver, 100, clock);

    expect(await svc.drain()).toBe(0); // first tick fails
    expect(rows[0].publishedAt).toBeNull();

    t += 1; // next tick, nextRetryAt (== prev now) is now due
    expect(await svc.drain()).toBe(1); // redelivered and published
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(rows[0].publishedAt).not.toBeNull();
    expect(rows[0].lastError).toBeNull();
  });

  it("honors backoff: a row is skipped until nextRetryAt is due", async () => {
    const rows = [makeRow("e1", new Date(0))];
    rows[0].attemptCount = 1; // force a >0 backoff on the next failure
    let t = new Date("2026-01-01T00:00:00Z").getTime();
    const clock = () => new Date(t);
    const db = makeFakeDb(rows, clock);
    const deliver = vi.fn(async () => {
      throw new Error("still failing");
    });
    const svc = new OutboxDrainService(db, deliver, 100, clock);

    await svc.drain(); // attemptCount -> 2, nextRetryAt = now + 30s
    expect(rows[0].nextRetryAt!.getTime()).toBe(t + 30_000);

    deliver.mockClear();
    t += 10_000; // 10s later: not yet due
    await svc.drain();
    expect(deliver).not.toHaveBeenCalled();

    t += 25_000; // now past the 30s backoff
    await svc.drain();
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it("dead-letters after the attempt ceiling and stops redelivering", async () => {
    const rows = [makeRow("e1", new Date(0))];
    let t = new Date("2026-01-01T00:00:00Z").getTime();
    const clock = () => new Date(t);
    const db = makeFakeDb(rows, clock);
    const deliver = vi.fn(async () => {
      throw new Error("permanent");
    });
    const svc = new OutboxDrainService(db, deliver, 100, clock, 3); // maxAttempts = 3

    for (let i = 0; i < 5; i++) {
      await svc.drain();
      t += 60 * 60_000; // jump past any backoff each tick
    }

    expect(rows[0].deadLetteredAt).not.toBeNull();
    expect(rows[0].publishedAt).toBeNull();
    expect(rows[0].nextRetryAt).toBeNull();
    expect(rows[0].attemptCount).toBe(3);
    expect(deliver).toHaveBeenCalledTimes(3); // not retried once dead-lettered
  });
});
