import { Job } from "../domain/job";
import { RetrySchedulingService, type RetryPolicy } from "../domain/job-state-machine";
import { JobDeferral, type JobHandlerRegistryPort } from "./ports";

export interface JobStorePort {
  load(jobId: string): Promise<Job | null>;
  save(job: Job): Promise<void>;
}

export class RunJobService {
  private readonly retry: RetrySchedulingService;

  constructor(
    private readonly store: JobStorePort,
    private readonly registry: JobHandlerRegistryPort,
    retryPolicy: RetryPolicy,
  ) {
    this.retry = new RetrySchedulingService(retryPolicy);
  }

  async runById(jobId: string): Promise<void> {
    const job = await this.store.load(jobId);
    if (!job) return;
    const now = new Date();
    if (!job.isClaimable(now)) return; // already terminal / running elsewhere -> idempotent no-op

    job.claim(now, 30_000);
    await this.store.save(job);
    await this.execute(job, now);
  }

  // Poll path: claimBatch already transitioned the job to RUNNING under FOR UPDATE SKIP LOCKED + lease,
  // so this isolate owns it — run the handler directly (runById would no-op on a non-PENDING job).
  async runClaimed(jobId: string): Promise<void> {
    const job = await this.store.load(jobId);
    if (!job) return;
    if (job.snapshot().status !== "RUNNING") return; // finalized/cancelled between claim and run
    await this.execute(job, new Date());
  }

  private async execute(job: Job, now: Date): Promise<void> {
    const snap = job.snapshot();
    const handler = this.registry.resolve(snap.kind);
    if (!handler) {
      job.fail(`no handler for kind ${snap.kind}`, this.retry.nextRunAfter(snap.attemptCount, now));
      await this.store.save(job);
      return;
    }

    try {
      const result = await handler(snap.payload, { jobId: snap.id, tenantId: snap.tenantId, externalRef: snap.externalRef });
      if (result instanceof JobDeferral) {
        job.defer(result.externalRef, result.runAfter);
      } else {
        job.succeed(result);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      job.fail(reason, this.retry.nextRunAfter(job.snapshot().attemptCount, now));
    }
    await this.store.save(job);
  }
}
