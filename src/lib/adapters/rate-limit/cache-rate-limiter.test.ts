import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CacheAdapter } from '@/lib/adapters/cache/types';
import { CacheRateLimiter } from './cache-rate-limiter';

// Minimal in-test cache honoring TTL against a mocked clock; exercises the read-modify-write path.
function fakeCache(): CacheAdapter {
  const store = new Map<string, { value: unknown; expiresAt: number | null }>();
  const live = (key: string) => {
    const e = store.get(key);
    if (!e) return null;
    if (e.expiresAt !== null && Date.now() >= e.expiresAt) {
      store.delete(key);
      return null;
    }
    return e;
  };
  return {
    async get<T>(key: string) {
      return (live(key)?.value as T) ?? null;
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      store.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
    },
    async delete(key: string) {
      store.delete(key);
    },
    async deletePattern() {},
    async has(key: string) {
      return live(key) !== null;
    },
    async acquireLock() {
      return true;
    },
    async releaseLock() {},
  };
}

// Cache exposing an atomic counter; exercises the incrWithTtl fast path.
function atomicCache() {
  const counts = new Map<string, number>();
  const expiry = new Map<string, number>();
  const base = fakeCache();
  return {
    ...base,
    async incrWithTtl(key: string, ttlSeconds: number) {
      if (expiry.has(key) && Date.now() >= (expiry.get(key) as number)) {
        counts.delete(key);
        expiry.delete(key);
      }
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      if (next === 1) expiry.set(key, Date.now() + ttlSeconds * 1000);
      return next;
    },
  } as CacheAdapter & { incrWithTtl(key: string, ttlSeconds: number): Promise<number> };
}

const LIMIT = 3;
const WINDOW = 60;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CacheRateLimiter (read-modify-write path)', () => {
  it('allows up to the limit then trips, and reports retry-after', async () => {
    const rl = new CacheRateLimiter(fakeCache());

    for (let i = 0; i < LIMIT; i++) {
      const r = await rl.consume('k', LIMIT, WINDOW);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(LIMIT - 1 - i);
    }

    const blocked = await rl.consume('k', LIMIT, WINDOW);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets after the window elapses', async () => {
    const rl = new CacheRateLimiter(fakeCache());
    for (let i = 0; i < LIMIT; i++) await rl.consume('k', LIMIT, WINDOW);
    expect((await rl.consume('k', LIMIT, WINDOW)).allowed).toBe(false);

    vi.setSystemTime(WINDOW * 1000 + 1);

    const afterReset = await rl.consume('k', LIMIT, WINDOW);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(LIMIT - 1);
  });

  it('keys are independent', async () => {
    const rl = new CacheRateLimiter(fakeCache());
    for (let i = 0; i < LIMIT; i++) await rl.consume('a', LIMIT, WINDOW);
    expect((await rl.consume('a', LIMIT, WINDOW)).allowed).toBe(false);
    expect((await rl.consume('b', LIMIT, WINDOW)).allowed).toBe(true);
  });
});

describe('CacheRateLimiter (atomic incrWithTtl path)', () => {
  it('trips at the limit and resets after the window', async () => {
    const rl = new CacheRateLimiter(atomicCache());

    for (let i = 0; i < LIMIT; i++) expect((await rl.consume('k', LIMIT, WINDOW)).allowed).toBe(true);
    expect((await rl.consume('k', LIMIT, WINDOW)).allowed).toBe(false);

    vi.setSystemTime(WINDOW * 1000 + 1);
    expect((await rl.consume('k', LIMIT, WINDOW)).allowed).toBe(true);
  });
});
