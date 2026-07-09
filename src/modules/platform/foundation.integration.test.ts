import { describe, it, expect, vi } from "vitest";
import { EnqueueJobService } from "./application/enqueue-job.service";
import { RunJobService } from "./application/run-job.service";
import { PollPendingJobsService } from "./application/poll-pending-jobs.service";
import { InProcessJobHandlerRegistry } from "./infra/registries/job-handler-registry";
import { Job } from "./domain/job";

describe("foundation queue + handler wiring", () => {
  it("enqueue (CRON) -> poll claims -> run executes the registered handler", async () => {
    const registry = new InProcessJobHandlerRegistry();
    const ran: unknown[] = [];
    registry.register("demo.kind", async (payload) => { ran.push(payload); return "done"; });

    const stored = new Map<string, Job>();
    let n = 0;
    const repo: any = {
      findByIdempotency: async () => null,
      insertPending: async (row: any) => {
        const id = "j" + ++n;
        stored.set(id, Job.rehydrate({
          id, tenantId: row.tenantId, kind: row.kind, status: "PENDING", dispatch: row.dispatch,
          payload: row.payload, attemptCount: 0, maxAttempts: row.maxAttempts, runAfter: row.runAfter,
          leaseExpiry: null, idempotencyKey: row.idempotencyKey, externalRef: null, result: null, failureReason: null,
        }));
        return { jobId: id };
      },
      // Mirror the real adapter: claim atomically transitions PENDING -> RUNNING (runClaimed no-ops otherwise).
      claimBatch: async (now: Date, _batchSize: number, leaseMs: number) => {
        const claimed: string[] = [];
        for (const [id, job] of stored) {
          if (job.isClaimable(now)) { job.claim(now, leaseMs); claimed.push(id); }
        }
        return claimed;
      },
    };
    const store: any = { load: async (id: string) => stored.get(id) ?? null, save: async (j: Job) => stored.set(j.snapshot().id, j) };

    const runJob = new RunJobService(store, registry, { baseMs: 1, factor: 2, maxMs: 10 });
    const enqueue = new EnqueueJobService(repo, registry, { run: vi.fn() } as any, { current: () => "default" } as any, runJob);
    const poll = new PollPendingJobsService(repo, runJob, { batchSize: 10, leaseMs: 1000 });

    await enqueue.enqueue({ kind: "demo.kind", payload: { hi: 1 }, dispatch: "CRON_POLL" });
    const count = await poll.poll();

    expect(count).toBe(1);
    expect(ran).toEqual([{ hi: 1 }]);
    expect([...stored.values()][0].snapshot().status).toBe("SUCCEEDED");
  });
});
