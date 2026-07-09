import { describe, it, expect, vi } from "vitest";
import { RunJobService } from "./run-job.service";
import { PollPendingJobsService } from "./poll-pending-jobs.service";
import { deferJob } from "./ports";
import { Job } from "../domain/job";

const jobRow = (over: Partial<any> = {}) =>
  Job.rehydrate({
    id: "j1", tenantId: "default", kind: "outbox.drain", status: "PENDING", dispatch: "CRON_POLL",
    payload: { n: 1 }, attemptCount: 0, maxAttempts: 3, runAfter: new Date(0), leaseExpiry: null,
    idempotencyKey: null, externalRef: null, result: null, failureReason: null, ...over,
  });

describe("RunJobService", () => {
  it("claims, runs the handler, and persists SUCCEEDED", async () => {
    const handler = vi.fn(async () => ({ drained: 1 }));
    const store = { load: vi.fn(async () => jobRow()), save: vi.fn(async (_job: unknown) => {}) };
    const registry = { resolve: vi.fn(() => handler), has: () => true };
    const svc = new RunJobService(store as any, registry as any, { baseMs: 1, factor: 2, maxMs: 10 });
    await svc.runById("j1");
    expect(handler).toHaveBeenCalledTimes(1);
    expect((store.save.mock.calls.at(-1)![0] as Job).snapshot().status).toBe("SUCCEEDED");
  });

  it("requeues PENDING on handler error while attempts remain", async () => {
    const handler = vi.fn(async () => { throw new Error("transient"); });
    const store = { load: vi.fn(async () => jobRow()), save: vi.fn(async (_job: unknown) => {}) };
    const registry = { resolve: vi.fn(() => handler), has: () => true };
    const svc = new RunJobService(store as any, registry as any, { baseMs: 1, factor: 2, maxMs: 10 });
    await svc.runById("j1");
    expect((store.save.mock.calls.at(-1)![0] as Job).snapshot().status).toBe("PENDING");
  });

  it("re-queues to PENDING with externalRef (not SUCCEEDED) when the handler returns a JobDeferral", async () => {
    const handler = vi.fn(async () => deferJob({ externalRef: "prov-9", runAfter: new Date(Date.now() + 5000) }));
    const store = { load: vi.fn(async () => jobRow({ kind: "media.video" })), save: vi.fn(async (_job: unknown) => {}) };
    const registry = { resolve: vi.fn(() => handler), has: () => true };
    const svc = new RunJobService(store as any, registry as any, { baseMs: 1, factor: 2, maxMs: 10 });
    await svc.runById("j1");
    const saved = (store.save.mock.calls.at(-1)![0] as Job).snapshot();
    expect(saved.status).toBe("PENDING");
    expect(saved.externalRef).toBe("prov-9");
    expect(saved.result).toBeNull();
  });

  it("skips a non-claimable (already terminal) job idempotently", async () => {
    const handler = vi.fn();
    const store = { load: vi.fn(async () => jobRow({ status: "SUCCEEDED" })), save: vi.fn(async () => {}) };
    const registry = { resolve: vi.fn(() => handler), has: () => true };
    const svc = new RunJobService(store as any, registry as any, { baseMs: 1, factor: 2, maxMs: 10 });
    await svc.runById("j1");
    expect(handler).not.toHaveBeenCalled();
  });

  it("runClaimed runs the handler on an already-claimed RUNNING job and persists SUCCEEDED", async () => {
    const handler = vi.fn(async () => ({ drained: 1 }));
    const store = { load: vi.fn(async () => jobRow({ status: "RUNNING", attemptCount: 1 })), save: vi.fn(async (_job: unknown) => {}) };
    const registry = { resolve: vi.fn(() => handler), has: () => true };
    const svc = new RunJobService(store as any, registry as any, { baseMs: 1, factor: 2, maxMs: 10 });
    await svc.runClaimed("j1");
    expect(handler).toHaveBeenCalledTimes(1);
    expect((store.save.mock.calls.at(-1)![0] as Job).snapshot().status).toBe("SUCCEEDED");
  });

  it("runClaimed no-ops when the job is no longer RUNNING", async () => {
    const handler = vi.fn();
    const store = { load: vi.fn(async () => jobRow({ status: "PENDING" })), save: vi.fn(async () => {}) };
    const registry = { resolve: vi.fn(() => handler), has: () => true };
    const svc = new RunJobService(store as any, registry as any, { baseMs: 1, factor: 2, maxMs: 10 });
    await svc.runClaimed("j1");
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("PollPendingJobsService", () => {
  it("claims a bounded batch and runs each claimed id (already RUNNING)", async () => {
    const repo = { claimBatch: vi.fn(async () => ["a", "b"]) };
    const runJob = { runById: vi.fn(async () => {}), runClaimed: vi.fn(async () => {}) };
    const svc = new PollPendingJobsService(repo as any, runJob as any, { batchSize: 10, leaseMs: 30000 });
    const ran = await svc.poll();
    expect(repo.claimBatch).toHaveBeenCalledWith(expect.any(Date), 10, 30000);
    expect(runJob.runClaimed).toHaveBeenCalledTimes(2);
    expect(runJob.runById).not.toHaveBeenCalled();
    expect(ran).toBe(2);
  });
});
