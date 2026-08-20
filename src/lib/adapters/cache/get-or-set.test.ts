import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cacheGetOrSet, setCache } from './index';
import type { CacheAdapter } from './types';

// Counts writes, because that is what this helper exists to reduce.
function fakeCache() {
  const store = new Map<string, unknown>();
  const writes: string[] = [];
  const adapter: CacheAdapter = {
    async get<T>(key: string): Promise<T | null> {
      return (store.get(key) as T) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      writes.push(key);
      store.set(key, value);
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async deletePattern(): Promise<void> {},
    async has(key: string): Promise<boolean> {
      return store.has(key);
    },
    async acquireLock(): Promise<boolean> {
      return true;
    },
    async releaseLock(): Promise<void> {},
  };
  return { adapter, store, writes };
}

let seq = 0;
const uniqueKey = () => `k:${++seq}`;

let cache: ReturnType<typeof fakeCache>;

beforeEach(() => {
  cache = fakeCache();
  setCache(cache.adapter);
});

describe('cacheGetOrSet', () => {
  it('loads and writes once on a miss', async () => {
    const key = uniqueKey();
    const load = vi.fn(async () => ['admin']);

    expect(await cacheGetOrSet(key, 900, load)).toEqual(['admin']);
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.writes).toEqual([key]);
  });

  it('serves a hit without loading or writing again', async () => {
    const key = uniqueKey();
    const load = vi.fn(async () => ['admin']);

    await cacheGetOrSet(key, 900, load);
    expect(await cacheGetOrSet(key, 900, load)).toEqual(['admin']);

    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.writes).toEqual([key]);
  });

  it('collapses concurrent misses onto one load and one write', async () => {
    const key = uniqueKey();
    const load = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return ['editor'];
    });

    const results = await Promise.all(Array.from({ length: 40 }, () => cacheGetOrSet(key, 900, load)));

    expect(results.every((r) => r[0] === 'editor')).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.writes).toEqual([key]);
  });

  it('keeps separate keys independent', async () => {
    const a = uniqueKey();
    const b = uniqueKey();
    await cacheGetOrSet(a, 900, async () => ['a']);
    await cacheGetOrSet(b, 900, async () => ['b']);
    expect(cache.writes).toEqual([a, b]);
    expect(await cacheGetOrSet(a, 900, async () => ['changed'])).toEqual(['a']);
  });

  it('does not cache a null result, so bogus keys cannot fill the namespace', async () => {
    const key = uniqueKey();
    const load = vi.fn(async () => null);

    expect(await cacheGetOrSet(key, 300, load)).toBeNull();
    expect(await cacheGetOrSet(key, 300, load)).toBeNull();

    expect(cache.writes).toEqual([]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('propagates a load failure to every concurrent caller and retries next time', async () => {
    const key = uniqueKey();
    const load = vi
      .fn<() => Promise<string[]>>()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValue(['recovered']);

    await expect(
      Promise.all([cacheGetOrSet(key, 900, load), cacheGetOrSet(key, 900, load)]),
    ).rejects.toThrow('db down');
    expect(load).toHaveBeenCalledTimes(1);

    // The failed load must not be pinned for the isolate's lifetime.
    expect(await cacheGetOrSet(key, 900, load)).toEqual(['recovered']);
    expect(cache.writes).toEqual([key]);
  });

  it('invalidation still takes effect immediately', async () => {
    const key = uniqueKey();
    await cacheGetOrSet(key, 900, async () => ['old']);
    await cache.adapter.delete(key);
    expect(await cacheGetOrSet(key, 900, async () => ['new'])).toEqual(['new']);
    expect(cache.writes).toEqual([key, key]);
  });
});
