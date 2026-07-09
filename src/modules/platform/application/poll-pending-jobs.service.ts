import type { JobRepositoryPort, RunJobPort } from "./ports";

export interface PollConfig {
  batchSize: number;
  leaseMs: number;
}

export class PollPendingJobsService {
  constructor(
    private readonly repo: JobRepositoryPort,
    private readonly runJob: RunJobPort,
    private readonly cfg: PollConfig,
  ) {}

  async poll(): Promise<number> {
    const ids = await this.repo.claimBatch(new Date(), this.cfg.batchSize, this.cfg.leaseMs);
    for (const id of ids) await this.runJob.runClaimed(id);
    return ids.length;
  }
}
