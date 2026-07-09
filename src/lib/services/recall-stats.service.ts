import { getBasePrisma } from '@/lib/db';
import { withTenantWhere } from '@/lib/repositories/tenant-helpers';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { getCache, CACHE_TTL } from '@/lib/adapters/cache';
import { createLogger } from '@/lib/logger';

const logger = createLogger('RecallStatsService');

export type RecallStatsRange = '7d' | '30d' | '90d' | 'all';

export interface RecallStats {
  range: RecallStatsRange;
  emailsSent: number;
  ordersRecovered: number;
  recoveryRate: number | null;
}

function sinceFromRange(range: RecallStatsRange): Date | null {
  if (range === 'all') return null;
  const days = { '7d': 7, '30d': 30, '90d': 90 }[range];
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function buildCacheKey(tenantId: string, range: RecallStatsRange): string {
  return `recall:stats:${tenantId}:${range}`;
}

export async function getRecallStats(range: RecallStatsRange): Promise<RecallStats> {
  const prisma = getBasePrisma();
  const tenantId = getCurrentTenantId();
  const cacheKey = buildCacheKey(tenantId, range);

  const cached = await getCache().get<RecallStats>(cacheKey);
  if (cached) return cached;

  const since = sinceFromRange(range);
  const createdAtFilter = since ? { createdAt: { gte: since } } : {};

  const [emailsSent, ordersRecovered] = await Promise.all([
    prisma.recallTouch.count({
      where: withTenantWhere({
        channel: 'email',
        firedAt: { not: null },
        ...createdAtFilter,
      }),
    }),
    prisma.recallAttempt.count({
      where: withTenantWhere({
        status: 'recovered',
        ...createdAtFilter,
      }),
    }),
  ]);

  const result: RecallStats = {
    range,
    emailsSent,
    ordersRecovered,
    recoveryRate: emailsSent === 0 ? null : ordersRecovered / emailsSent,
  };

  await getCache().set(cacheKey, result, CACHE_TTL.SHORT);
  logger.debug('Computed recall stats', { tenantId, ...result });

  return result;
}
