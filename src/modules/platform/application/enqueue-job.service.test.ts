import { describe, it, expect, vi } from "vitest";
import { EnqueueJobService } from "./enqueue-job.service";

const makeDeps = () => {
  const existing = new Map<string, { jobId: string; status: string }>();
  return {
    rows: existing,
    repo: {
      findByIdempotency: vi.fn(async (tenantId: string, kind: string, key: string) =>
        existing.get(`${tenantId}:${kind}:${key}`) ?? null,
      ),
      insertPending: vi.fn(async (row: any) => {
        const id = "job_" + (existing.size + 1);
        if (row.idempotencyKey) existing.set(`${row.tenantId}:${row.kind}:${row.idempotencyKey}`, { jobId: id, status: "PENDING" });
        return { jobId: id };
      }),
      requeue: vi.fn(async (jobId: string) => {
        for (const v of existing.values()) if (v.jobId === jobId) v.status = "PENDING";
      }),
    },
    registry: { has: vi.fn((kind: string) => kind === "outbox.drain" || kind === "media.image.generate") },
    deferred: { run: vi.fn() },
    tenant: { current: () => "default" },
    runJob: { runById: vi.fn(async () => {}) },
  };
};

describe("EnqueueJobService", () => {
  it("rejects a kind not in the handler registry", async () => {
    const d = makeDeps();
    const svc = new EnqueueJobService(d.repo as any, d.registry as any, d.deferred as any, d.tenant as any, d.runJob as any);
    await expect(svc.enqueue({ kind: "nope", payload: {} })).rejects.toThrow(/registry/i);
  });

  it("dedupes on (tenantId, kind, idempotencyKey)", async () => {
    const d = makeDeps();
    const svc = new EnqueueJobService(d.repo as any, d.registry as any, d.deferred as any, d.tenant as any, d.runJob as any);
    const first = await svc.enqueue({ kind: "media.image.generate", payload: {}, idempotencyKey: "k1" });
    const second = await svc.enqueue({ kind: "media.image.generate", payload: {}, idempotencyKey: "k1" });
    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);
    expect(second.jobId).toBe(first.jobId);
    expect(d.repo.insertPending).toHaveBeenCalledTimes(1);
  });

  it("requeues a terminal job when coalesce is set (recompute debounce)", async () => {
    const d = makeDeps();
    const svc = new EnqueueJobService(d.repo as any, d.registry as any, d.deferred as any, d.tenant as any, d.runJob as any);
    const first = await svc.enqueue({ kind: "media.image.generate", payload: {}, idempotencyKey: "k1", coalesce: true });
    d.rows.get(`default:media.image.generate:k1`)!.status = "SUCCEEDED";
    const second = await svc.enqueue({ kind: "media.image.generate", payload: {}, idempotencyKey: "k1", coalesce: true });
    expect(second.deduped).toBe(false);
    expect(second.jobId).toBe(first.jobId);
    expect(d.repo.requeue).toHaveBeenCalledTimes(1);
    expect(d.repo.insertPending).toHaveBeenCalledTimes(1); // never a colliding second insert
  });

  it("keeps exactly-once dedup for a terminal job without coalesce (no resend)", async () => {
    const d = makeDeps();
    const svc = new EnqueueJobService(d.repo as any, d.registry as any, d.deferred as any, d.tenant as any, d.runJob as any);
    const first = await svc.enqueue({ kind: "media.image.generate", payload: {}, idempotencyKey: "k1" });
    d.rows.get(`default:media.image.generate:k1`)!.status = "SUCCEEDED";
    const second = await svc.enqueue({ kind: "media.image.generate", payload: {}, idempotencyKey: "k1" });
    expect(second.deduped).toBe(true);
    expect(second.jobId).toBe(first.jobId);
    expect(d.repo.requeue).not.toHaveBeenCalled();
    expect(d.repo.insertPending).toHaveBeenCalledTimes(1);
  });

  it("schedules INLINE_WAIT_UNTIL jobs via deferred execution", async () => {
    const d = makeDeps();
    const svc = new EnqueueJobService(d.repo as any, d.registry as any, d.deferred as any, d.tenant as any, d.runJob as any);
    await svc.enqueue({ kind: "media.image.generate", payload: {}, dispatch: "INLINE_WAIT_UNTIL" });
    expect(d.deferred.run).toHaveBeenCalledTimes(1);
  });

  it("does NOT eagerly run CRON_POLL jobs (cron picks them up)", async () => {
    const d = makeDeps();
    const svc = new EnqueueJobService(d.repo as any, d.registry as any, d.deferred as any, d.tenant as any, d.runJob as any);
    await svc.enqueue({ kind: "outbox.drain", payload: {}, dispatch: "CRON_POLL" });
    expect(d.deferred.run).not.toHaveBeenCalled();
  });
});
