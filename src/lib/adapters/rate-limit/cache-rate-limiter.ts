import type { CacheAdapter } from '@/lib/adapters/cache/types';
import type { RateLimiter, RateLimitResult } from './types';

const PFX = 'ratelimit:';

interface WindowState {
  count: number;
  resetAt: number;
}

// Some cache adapters (Redis) expose an atomic increment; using it avoids the
// read-modify-write race that lets attackers slip extra hits past the limit.
interface AtomicCounter {
  incrWithTtl(key: string, ttlSeconds: number): Promise<number>;
}

function hasAtomicCounter(cache: CacheAdapter): cache is CacheAdapter & AtomicCounter {
  return typeof (cache as Partial<AtomicCounter>).incrWithTtl === 'function';
}

function deny(retryAfterSeconds: number): RateLimitResult {
  return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
}

function allow(remaining: number): RateLimitResult {
  return { allowed: true, remaining: Math.max(remaining, 0), retryAfterSeconds: 0 };
}

export class CacheRateLimiter implements RateLimiter {
  constructor(private readonly cache: CacheAdapter) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const fullKey = PFX + key;

    if (hasAtomicCounter(this.cache)) {
      const count = await this.cache.incrWithTtl(fullKey, windowSeconds);
      return count > limit ? deny(windowSeconds) : allow(limit - count);
    }

    const now = Date.now();
    const state = await this.cache.get<WindowState>(fullKey);

    if (!state || now >= state.resetAt) {
      const next: WindowState = { count: 1, resetAt: now + windowSeconds * 1000 };
      await this.cache.set(fullKey, next, windowSeconds);
      return allow(limit - 1);
    }

    const remainingMs = state.resetAt - now;
    if (state.count >= limit) {
      return deny(Math.ceil(remainingMs / 1000));
    }

    const ttlSeconds = Math.max(Math.ceil(remainingMs / 1000), 1);
    await this.cache.set(fullKey, { count: state.count + 1, resetAt: state.resetAt }, ttlSeconds);
    return allow(limit - state.count - 1);
  }
}
