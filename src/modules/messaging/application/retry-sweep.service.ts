import { DispatchStatus } from '../domain/value-objects';
import { RetrySchedule } from '../domain/retry-schedule';
import { createLogger } from '@/lib/logger';
import type { DispatchRepositoryPort, JobEnqueuePort, ClockPort } from './ports/outbound';

const logger = createLogger('Messaging:RetrySweep');

export class RetrySweepService {
  constructor(
    private readonly dispatches: DispatchRepositoryPort,
    private readonly jobs: JobEnqueuePort,
    private readonly schedule: RetrySchedule,
    private readonly clock: ClockPort,
  ) {}

  async sweep(batchSize: number): Promise<{ retried: number; canceled: number }> {
    const now = this.clock.now();
    const due = await this.dispatches.findRetryable(batchSize, now);
    let retried = 0;
    let canceled = 0;
    for (const dispatch of due) {
      if (dispatch.status !== DispatchStatus.FAILED) continue;
      const next = this.schedule.computeNext(dispatch.attemptCount, now);
      if (next === null) {
        dispatch.cancel();
        await this.dispatches.save(dispatch);
        canceled += 1;
        continue;
      }
      await this.jobs.enqueue({
        kind: 'messaging.send',
        payload: { dispatchId: dispatch.id, retry: true },
        idempotencyKey: `messaging.send:${dispatch.id}:attempt:${dispatch.attemptCount + 1}`,
        dispatch: 'INLINE_WAIT_UNTIL',
        runAfter: next,
      });
      retried += 1;
    }
    logger.info('retry sweep complete', { retried, canceled });
    return { retried, canceled };
  }
}
