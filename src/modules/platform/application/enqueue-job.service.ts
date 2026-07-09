import type { EnqueueJobInput } from "../../shared-kernel";
import type { JobRepositoryPort, JobHandlerRegistryPort, DeferredExecutionPort, TenantContextPort, RunJobPort } from "./ports";

export class EnqueueJobService {
  constructor(
    private readonly repo: JobRepositoryPort,
    private readonly registry: JobHandlerRegistryPort,
    private readonly deferred: DeferredExecutionPort,
    private readonly tenant: TenantContextPort,
    private readonly runJob: RunJobPort,
  ) {}

  async enqueue(input: EnqueueJobInput): Promise<{ jobId: string; deduped: boolean }> {
    if (!this.registry.has(input.kind)) {
      throw new Error(`job kind "${input.kind}" is not in the handler registry`);
    }
    const tenantId = this.tenant.current();
    const dispatch = input.dispatch ?? "INLINE_WAIT_UNTIL";

    if (input.idempotencyKey) {
      const existing = await this.repo.findByIdempotency(tenantId, input.kind, input.idempotencyKey);
      if (existing) {
        const terminal = existing.status === "SUCCEEDED" || existing.status === "FAILED" || existing.status === "CANCELLED";
        // The unique([tenantId, kind, idempotencyKey]) constraint is permanent, so a fresh
        // insert would collide. Coalescing keys requeue the existing job; exactly-once dedup.
        if (!terminal || !input.coalesce) return { jobId: existing.jobId, deduped: true };
        const runAfter = input.runAfter ?? new Date();
        await this.repo.requeue(existing.jobId, runAfter);
        if (dispatch === "INLINE_WAIT_UNTIL") {
          this.deferred.run(() => this.runJob.runById(existing.jobId));
        }
        return { jobId: existing.jobId, deduped: false };
      }
    }

    const { jobId } = await this.repo.insertPending({
      tenantId,
      kind: input.kind,
      payload: input.payload,
      dispatch,
      idempotencyKey: input.idempotencyKey ?? null,
      runAfter: input.runAfter ?? new Date(),
      maxAttempts: input.maxAttempts ?? 5,
    });

    // INLINE jobs run now via waitUntil; CRON_POLL jobs are left for the scheduled drain.
    if (dispatch === "INLINE_WAIT_UNTIL") {
      this.deferred.run(() => this.runJob.runById(jobId));
    }
    return { jobId, deduped: false };
  }
}
