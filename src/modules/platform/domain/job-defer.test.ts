import { describe, it, expect } from 'vitest';
import { Job, type JobSnapshot } from './job';

function pendingClaimed(over: Partial<JobSnapshot> = {}): Job {
  const job = Job.rehydrate({
    id: 'j1', tenantId: 'default', kind: 'media.video', status: 'PENDING', dispatch: 'CRON_POLL',
    payload: {}, result: null, externalRef: null, idempotencyKey: null,
    attemptCount: 0, maxAttempts: 5, runAfter: new Date(0), leaseExpiry: null, failureReason: null,
    ...over,
  });
  job.claim(new Date(), 30_000); // RUNNING, attemptCount -> 1
  return job;
}

describe('Job.defer', () => {
  it('re-queues to PENDING with the next runAfter and persists externalRef', () => {
    const job = pendingClaimed();
    const next = new Date(Date.now() + 5_000);
    job.defer('provider-job-123', next);
    const s = job.snapshot();
    expect(s.status).toBe('PENDING');
    expect(s.runAfter).toEqual(next);
    expect(s.externalRef).toBe('provider-job-123');
    expect(s.leaseExpiry).toBeNull();
  });

  it('does not consume a failure attempt (a poll cycle nets zero against maxAttempts)', () => {
    const job = pendingClaimed(); // attemptCount becomes 1 on claim
    job.defer('ext', new Date());
    expect(job.snapshot().attemptCount).toBe(0); // the claim increment is undone
  });

  it('keeps the existing externalRef when deferring with null (subsequent polls)', () => {
    const job = pendingClaimed({ externalRef: 'ext-existing' });
    job.defer(null, new Date());
    expect(job.snapshot().externalRef).toBe('ext-existing');
  });

  it('throws when the job is already terminal', () => {
    const job = pendingClaimed();
    job.succeed({ url: 'https://cdn/x.png' });
    expect(() => job.defer('ext', new Date())).toThrow();
  });
});
