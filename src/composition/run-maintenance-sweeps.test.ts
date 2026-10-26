import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  jobDeleteMany: vi.fn(async (_args: { where: Record<string, any> }) => ({ count: 3 })),
  dispatchDeleteMany: vi.fn(async (_args: { where: Record<string, any> }) => ({ count: 5 })),
  pageEngagementDeleteMany: vi.fn(async (_args: { where: Record<string, any> }) => ({ count: 7 })),
}));

vi.mock('@/lib/db', () => ({
  getBasePrisma: () => ({
    job: { deleteMany: h.jobDeleteMany },
    dispatch: { deleteMany: h.dispatchDeleteMany },
    pageEngagement: { deleteMany: h.pageEngagementDeleteMany },
  }),
}));

import {
  runMaintenanceJobsCleanup,
  runMaintenanceNotificationLogsCleanup,
  runPageEngagementCleanup,
  runMaintenanceSweeps,
} from './run-maintenance-sweeps';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60_000;

const DELEGATES: Record<string, ReturnType<typeof vi.fn>> = {
  job: h.jobDeleteMany,
  dispatch: h.dispatchDeleteMany,
  pageEngagement: h.pageEngagementDeleteMany,
};

function deleteManyArgs(delegate: keyof typeof DELEGATES): { where: Record<string, any> } {
  return DELEGATES[delegate].mock.calls[0]![0].where;
}

beforeEach(() => {
  h.jobDeleteMany.mockClear();
  h.dispatchDeleteMany.mockClear();
  h.pageEngagementDeleteMany.mockClear();
});

describe('maintenance sweeps', () => {
  it('deletes terminal jobs older than 7 days', async () => {
    const out = await runMaintenanceJobsCleanup(NOW);
    expect(out.deleted).toBe(3);
    const where = deleteManyArgs('job');
    expect(where.status).toEqual({ in: ['SUCCEEDED', 'FAILED', 'CANCELLED'] });
    expect(where.updatedAt.lt).toEqual(new Date(NOW - 7 * DAY));
  });

  it('deletes settled dispatch logs older than 30 days (no pending retry)', async () => {
    const out = await runMaintenanceNotificationLogsCleanup(NOW);
    expect(out.deleted).toBe(5);
    const where = deleteManyArgs('dispatch');
    expect(where.createdAt.lt).toEqual(new Date(NOW - 30 * DAY));
    expect(where.nextRetryAt).toBeNull();
  });

  it('drops page engagement rows past the retention window', async () => {
    const out = await runPageEngagementCleanup(NOW);
    expect(out.deleted).toBeGreaterThanOrEqual(0);
    const where = deleteManyArgs('pageEngagement');
    // 180 days
    expect(NOW - (where.createdAt.lt as Date).getTime()).toBe(180 * 24 * 60 * 60_000);
  });

  it('runMaintenanceSweeps returns all three counts', async () => {
    const out = await runMaintenanceSweeps(NOW);
    expect(out).toEqual({ jobs: 3, dispatch: 5, engagement: 7 });
  });
});
