import type { JobRepositoryPort, RunJobPort } from "./ports";

export interface PollConfig {
  batchSize: number;
  leaseMs: number;
}

export type WithTenant = <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>;

export class PollPendingJobsService {
  constructor(
    private readonly repo: JobRepositoryPort,
    private readonly runJob: RunJobPort,
    private readonly cfg: PollConfig,
    private readonly withTenant: WithTenant,
  ) {}

  // The claim is cross-tenant on purpose (one poller drains everything), so each job must be
  // executed inside its OWN tenant — otherwise the tenant-scoped load returns null after the
  // claim already consumed an attempt, and the job is eventually starved out at maxAttempts.
  async poll(): Promise<number> {
    const claimed = await this.repo.claimBatch(new Date(), this.cfg.batchSize, this.cfg.leaseMs);
    for (const job of claimed) {
      await this.withTenant(job.tenantId, () => this.runJob.runClaimed(job.id)).catch(() => {
        // A single job's failure is already recorded by RunJobService; never abort the batch.
      });
    }
    return claimed.length;
  }
}
