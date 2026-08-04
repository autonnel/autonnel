import type { APIRoute } from 'astro';
import { getBasePrisma } from '@/lib/db';
import { getCache } from '@/lib/adapters/cache';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Health');

type CheckStatus = 'ok' | 'error';

// The public response carries STATUS ONLY. Connection exceptions routinely contain dependency
// hostnames, ports, database names and topology, which must stay in access-controlled logs.
interface DatabaseCheck {
  status: CheckStatus;
  latencyMs?: number;
}

interface CacheCheck {
  status: CheckStatus;
  type: string;
  latencyMs?: number;
}

function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}

async function checkDatabase(): Promise<[DatabaseCheck, boolean]> {
  const prisma = getBasePrisma();
  const t0 = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return [{ status: 'ok', latencyMs: elapsedMs(t0) }, true];
  } catch (error) {
    logger.error('health: database check failed', { error });
    return [{ status: 'error' }, false];
  }
}

async function checkCache(): Promise<[CacheCheck, boolean]> {
  const cache = getCache();
  const maybePing = (cache as { ping?: () => Promise<boolean> }).ping;

  if (typeof maybePing !== 'function') {
    return [{ status: 'ok', type: 'memory' }, true];
  }

  const t0 = performance.now();
  try {
    const pong = await maybePing.call(cache);
    if (!pong) {
      logger.error('health: cache PING returned false');
      return [{ status: 'error', type: 'redis' }, false];
    }
    return [{ status: 'ok', type: 'redis', latencyMs: elapsedMs(t0) }, true];
  } catch (error) {
    logger.error('health: cache check failed', { error });
    return [{ status: 'error', type: 'redis' }, false];
  }
}

export const GET: APIRoute = async () => {
  const [[database, dbOk], [cache, cacheOk]] = await Promise.all([
    checkDatabase(),
    checkCache(),
  ]);

  const healthy = dbOk && cacheOk;

  const body = JSON.stringify({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks: { database, cache },
  });

  return new Response(body, {
    status: healthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
};
