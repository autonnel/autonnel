import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    scan: vi.fn(),
    ping: vi.fn(),
    quit: vi.fn(),
    on: vi.fn(),
    status: 'ready',
  },
}));

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => mockRedis),
}));

import { createRedisCache } from '@/lib/adapters/cache/redis';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RedisCacheAdapter', () => {
  it('get returns parsed JSON when Redis returns a string', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ x: 1 }));
    const c = createRedisCache({});
    expect(await c.get<{ x: number }>('k')).toEqual({ x: 1 });
    expect(mockRedis.get).toHaveBeenCalledWith('autonnel:k');
  });

  it('get returns null when Redis returns null', async () => {
    mockRedis.get.mockResolvedValue(null);
    expect(await createRedisCache({}).get('k')).toBeNull();
  });

  it('get swallows errors and returns null', async () => {
    mockRedis.get.mockRejectedValue(new Error('boom'));
    expect(await createRedisCache({}).get('k')).toBeNull();
  });

  it('set with TTL uses SETEX', async () => {
    mockRedis.setex.mockResolvedValue('OK');
    await createRedisCache({}).set('k', { a: 1 }, 60);
    expect(mockRedis.setex).toHaveBeenCalledWith('autonnel:k', 60, JSON.stringify({ a: 1 }));
  });

  it('set without TTL uses SET', async () => {
    mockRedis.set.mockResolvedValue('OK');
    await createRedisCache({}).set('k', 1);
    expect(mockRedis.set).toHaveBeenCalledWith('autonnel:k', '1');
  });

  it('delete uses DEL with prefixed key', async () => {
    mockRedis.del.mockResolvedValue(1);
    await createRedisCache({}).delete('k');
    expect(mockRedis.del).toHaveBeenCalledWith('autonnel:k');
  });

  it('deletePattern scans and deletes keys', async () => {
    mockRedis.scan.mockResolvedValue(['0', ['autonnel:p:1', 'autonnel:p:2']]);
    mockRedis.del.mockResolvedValue(2);
    await createRedisCache({}).deletePattern('p:*');
    expect(mockRedis.scan).toHaveBeenCalled();
    expect(mockRedis.del).toHaveBeenCalledWith('autonnel:p:1', 'autonnel:p:2');
  });

  it('has returns boolean from EXISTS', async () => {
    mockRedis.exists.mockResolvedValue(1);
    expect(await createRedisCache({}).has('k')).toBe(true);
    mockRedis.exists.mockResolvedValue(0);
    expect(await createRedisCache({}).has('k')).toBe(false);
  });

  it('acquireLock uses SET NX EX and returns boolean', async () => {
    mockRedis.set.mockResolvedValue('OK');
    expect(await createRedisCache({}).acquireLock('lk', 30)).toBe(true);
    expect(mockRedis.set).toHaveBeenCalledWith('autonnel:lk', '1', 'EX', 30, 'NX');
    mockRedis.set.mockResolvedValue(null);
    expect(await createRedisCache({}).acquireLock('lk', 30)).toBe(false);
  });

  it('ping returns true when Redis responds with PONG', async () => {
    mockRedis.ping.mockResolvedValue('PONG');
    expect(await createRedisCache({}).ping()).toBe(true);
  });

  it('uses custom keyPrefix when provided', async () => {
    mockRedis.get.mockResolvedValue(null);
    await createRedisCache({ keyPrefix: 'myapp:' }).get('k');
    expect(mockRedis.get).toHaveBeenCalledWith('myapp:k');
  });
});
