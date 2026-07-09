import type { PostbackRepositoryPort } from './ports/outbound';

interface Deps {
  postbackRepo: PostbackRepositoryPort;
  jobQueue: { enqueue(job: { kind: string; idempotencyKey: string; payload: unknown; coalesce?: boolean }): Promise<void> };
  now: () => number;
}

export class RetrySweepService {
  constructor(private readonly deps: Deps) {}

  async retrySweep(input: { limit: number }): Promise<{ processed: number }> {
    const due = await this.deps.postbackRepo.claimDuePending(input.limit, this.deps.now());
    for (const pb of due) {
      await this.deps.jobQueue.enqueue({
        kind: 'ads.postback.dispatch',
        idempotencyKey: `${pb.eventId}:${pb.destinationId}`,
        payload: { postbackId: pb.id },
        coalesce: true,
      });
    }
    return { processed: due.length };
  }
}
