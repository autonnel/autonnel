import { getBasePrisma } from '../lib/db';
import { createLogger } from '../lib/logger';

const logger = createLogger('MaintenanceSweeps');

const TERMINAL_JOB_STATUSES = ['SUCCEEDED', 'FAILED', 'CANCELLED'] as const;
const JOB_RETENTION_MS = 7 * 24 * 60 * 60_000;
const DISPATCH_RETENTION_MS = 30 * 24 * 60 * 60_000;

// maintenance.jobs: drop terminal Job rows past retention so the queue table stays bounded.
export async function runMaintenanceJobsCleanup(now: number = Date.now()): Promise<{ deleted: number }> {
  const cutoff = new Date(now - JOB_RETENTION_MS);
  const res = await getBasePrisma().job.deleteMany({
    where: { status: { in: [...TERMINAL_JOB_STATUSES] }, updatedAt: { lt: cutoff } },
  });
  logger.info('maintenance.jobs cleanup finished', { deleted: res.count });
  return { deleted: res.count };
}

// maintenance.notification-logs: drop settled Dispatch rows past retention (no pending retry).
export async function runMaintenanceNotificationLogsCleanup(now: number = Date.now()): Promise<{ deleted: number }> {
  const cutoff = new Date(now - DISPATCH_RETENTION_MS);
  const res = await getBasePrisma().dispatch.deleteMany({
    where: { createdAt: { lt: cutoff }, nextRetryAt: null },
  });
  logger.info('maintenance.notification-logs cleanup finished', { deleted: res.count });
  return { deleted: res.count };
}

export async function runMaintenanceSweeps(now: number = Date.now()): Promise<{ jobs: number; dispatch: number }> {
  const jobs = await runMaintenanceJobsCleanup(now);
  const dispatch = await runMaintenanceNotificationLogsCleanup(now);
  return { jobs: jobs.deleted, dispatch: dispatch.deleted };
}
