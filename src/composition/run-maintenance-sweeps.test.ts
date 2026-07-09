import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  jobDeleteMany: vi.fn(async (_args: { where: Record<string, any> }) => ({ count: 3 })),
  dispatchDeleteMany: vi.fn(async (_args: { where: Record<string, any> }) => ({ count: 5 })),
}));

vi.mock('@/lib/db', () => ({
  getBasePrisma: () => ({
    job: { deleteMany: h.jobDeleteMany },
    dispatch: { deleteMany: h.dispatchDeleteMany },
  }),
}));

import {
  runMaintenanceJobsCleanup,
  runMaintenanceNotificationLogsCleanup,
  runMaintenanceSweeps,
} from './run-maintenance-sweeps';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60_000;

beforeEach(() => {
  h.jobDeleteMany.mockClear();
  h.dispatchDeleteMany.mockClear();
});

describe('maintenance sweeps', () => {
  it('deletes terminal jobs older than 7 days', async () => {
    const out = await runMaintenanceJobsCleanup(NOW);
    expect(out.deleted).toBe(3);
    const where = h.jobDeleteMany.mock.calls[0]![0].where;
    expect(where.status).toEqual({ in: ['SUCCEEDED', 'FAILED', 'CANCELLED'] });
    expect(where.updatedAt.lt).toEqual(new Date(NOW - 7 * DAY));
  });

  it('deletes settled dispatch logs older than 30 days (no pending retry)', async () => {
    const out = await runMaintenanceNotificationLogsCleanup(NOW);
    expect(out.deleted).toBe(5);
    const where = h.dispatchDeleteMany.mock.calls[0]![0].where;
    expect(where.createdAt.lt).toEqual(new Date(NOW - 30 * DAY));
    expect(where.nextRetryAt).toBeNull();
  });

  it('runMaintenanceSweeps returns both counts', async () => {
    const out = await runMaintenanceSweeps(NOW);
    expect(out).toEqual({ jobs: 3, dispatch: 5 });
  });
});
