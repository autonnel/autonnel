import { describe, it, expect } from 'vitest';
import { PollPendingJobsService } from './poll-pending-jobs.service';

describe('PollPendingJobsService', () => {
  it('runs each claimed job inside its own tenant context', async () => {
    const seen: { tenant: string; jobId: string }[] = [];
    let active = 'default';

    const repo = {
      claimBatch: async () => [
        { id: 'j1', tenantId: 'tenant-a' },
        { id: 'j2', tenantId: 'tenant-b' },
      ],
    } as never;
    const runJob = {
      runClaimed: async (id: string) => {
        seen.push({ tenant: active, jobId: id });
      },
    } as never;
    const withTenant = async <T>(tenantId: string, fn: () => Promise<T>): Promise<T> => {
      const previous = active;
      active = tenantId;
      try {
        return await fn();
      } finally {
        active = previous;
      }
    };

    const service = new PollPendingJobsService(repo, runJob, { batchSize: 50, leaseMs: 30_000 }, withTenant);
    const ran = await service.poll();

    expect(ran).toBe(2);
    expect(seen).toEqual([
      { tenant: 'tenant-a', jobId: 'j1' },
      { tenant: 'tenant-b', jobId: 'j2' },
    ]);
  });

  it('one job failing does not stop the rest of the batch', async () => {
    const done: string[] = [];
    const repo = {
      claimBatch: async () => [
        { id: 'bad', tenantId: 't1' },
        { id: 'good', tenantId: 't2' },
      ],
    } as never;
    const runJob = {
      runClaimed: async (id: string) => {
        if (id === 'bad') throw new Error('handler exploded');
        done.push(id);
      },
    } as never;
    const withTenant = async <T>(_t: string, fn: () => Promise<T>) => fn();

    const service = new PollPendingJobsService(repo, runJob, { batchSize: 50, leaseMs: 30_000 }, withTenant);
    const ran = await service.poll();

    expect(done).toEqual(['good']);
    expect(ran).toBe(2);
  });
});
