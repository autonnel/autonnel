import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryCacheAdapter } from '@/lib/adapters/cache/memory';

let cache: MemoryCacheAdapter;

beforeEach(() => {
  cache = new MemoryCacheAdapter();
});

afterEach(() => {
  cache.destroy();
});

describe('MemoryCacheAdapter', () => {
  it('set and get round-trips a value', async () => {
    await cache.set('k', { a: 1 });
    expect(await cache.get<{ a: number }>('k')).toEqual({ a: 1 });
  });

  it('get returns null for missing key', async () => {
    expect(await cache.get('nope')).toBeNull();
  });

  it('respects TTL — expired entries return null and are evicted', async () => {
    await cache.set('k', 'v', 0.001);
    await new Promise((r) => setTimeout(r, 10));
    expect(await cache.get('k')).toBeNull();
  });

  it('delete removes a key', async () => {
    await cache.set('k', 1);
    await cache.delete('k');
    expect(await cache.get('k')).toBeNull();
  });

  it('deletePattern removes keys matching a glob', async () => {
    await cache.set('p:a', 1);
    await cache.set('p:b', 2);
    await cache.set('q:c', 3);
    await cache.deletePattern('p:*');
    expect(await cache.get('p:a')).toBeNull();
    expect(await cache.get('p:b')).toBeNull();
    expect(await cache.get('q:c')).toBe(3);
  });

  it('has returns true for existing keys, false otherwise', async () => {
    await cache.set('k', 'v');
    expect(await cache.has('k')).toBe(true);
    expect(await cache.has('missing')).toBe(false);
  });

  it('acquireLock succeeds the first time and fails while held', async () => {
    expect(await cache.acquireLock('lock', 60)).toBe(true);
    expect(await cache.acquireLock('lock', 60)).toBe(false);
  });

  it('releaseLock clears the lock so it can be re-acquired', async () => {
    await cache.acquireLock('lock', 60);
    await cache.releaseLock('lock');
    expect(await cache.acquireLock('lock', 60)).toBe(true);
  });

  it('size and clear manage the underlying map', async () => {
    await cache.set('a', 1);
    await cache.set('b', 2);
    expect(cache.size()).toBe(2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
