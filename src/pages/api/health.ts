import type { APIRoute } from 'astro';
import { getBasePrisma } from '@/lib/db';
import { getCache } from '@/lib/adapters/cache';

type CheckStatus = 'ok' | 'error';

interface DatabaseCheck {
  status: CheckStatus;
  latencyMs?: number;
  error?: string;
}

interface CacheCheck {
  status: CheckStatus;
  type: string;
  latencyMs?: number;
  error?: string;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
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
  } catch (err) {
    return [{ status: 'error', error: errorMessage(err) }, false];
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
      return [{ status: 'error', type: 'redis', error: 'Redis PING failed' }, false];
    }
    return [{ status: 'ok', type: 'redis', latencyMs: elapsedMs(t0) }, true];
  } catch (err) {
    return [{ status: 'error', type: 'redis', error: errorMessage(err) }, false];
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
