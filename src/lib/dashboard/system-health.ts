import { getCache } from '@/lib/adapters/cache';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { CRON_JOBS } from '@/lib/cron/catalog';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SystemHealth');

const CACHE_TTL_SECONDS = 30;
const CRON_STALL_THRESHOLD_MS = 10 * 60_000;
const CRON_WATCH_THRESHOLD_MS = 5 * 60_000;
const LAST_RUN_KEY_PREFIX = 'cron:lastrun:';

export type HealthStatus = 'healthy' | 'degraded';

export interface SystemHealth {
  status: HealthStatus;
  reason: string | null;
}

async function safeMaxLastRun(): Promise<number | null> {
  const cache = getCache();
  const watched = CRON_JOBS.filter((j) => j.intervalMs <= CRON_WATCH_THRESHOLD_MS);
  if (watched.length === 0) return null;

  const values = await Promise.all(
    watched.map(async (job) => {
      try {
        const v = await cache.get<number>(`${LAST_RUN_KEY_PREFIX}${job.name}`);
        return typeof v === 'number' && Number.isFinite(v) ? v : null;
      } catch (err) {
        logger.warn('Failed to read cron last-run for health check', { job: job.name, error: err });
        return null;
      }
    }),
  );

  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return Math.max(...present);
}

export async function loadSystemHealth(): Promise<SystemHealth> {
  const tenantId = getCurrentTenantId();
  const cache = getCache();
  const cacheKey = `system:health:${tenantId}`;

  try {
    const cached = await cache.get<SystemHealth>(cacheKey);
    if (cached && (cached.status === 'healthy' || cached.status === 'degraded')) {
      return cached;
    }
  } catch (err) {
    logger.warn('Health cache read failed', { error: err });
  }

  const cronMaxLastRun = await safeMaxLastRun();

  let result: SystemHealth;
  if (cronMaxLastRun !== null && Date.now() - cronMaxLastRun > CRON_STALL_THRESHOLD_MS) {
    const minutes = Math.floor((Date.now() - cronMaxLastRun) / 60_000);
    result = { status: 'degraded', reason: `Cron stalled (${minutes}m ago)` };
  } else {
    result = { status: 'healthy', reason: null };
  }

  try {
    await cache.set(cacheKey, result, CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn('Health cache write failed', { error: err });
  }

  return result;
}
