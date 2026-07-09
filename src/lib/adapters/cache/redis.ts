import Redis from 'ioredis';
import type { CacheAdapter } from './types';
import { readEnv } from '@/lib/runtime/env';
import { createLogger } from '@/lib/logger';

const log = createLogger('Redis');

const DEFAULT_PREFIX = 'autonnel:';
const SCAN_BATCH = 100;

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

function parseIntEnv(raw: string | undefined): number | undefined {
  return raw === undefined || raw === '' ? undefined : parseInt(raw, 10);
}

function envConfig(): RedisConfig {
  return {
    url: readEnv('REDIS_URL'),
    host: readEnv('REDIS_HOST'),
    port: parseIntEnv(readEnv('REDIS_PORT')),
    password: readEnv('REDIS_PASSWORD'),
    db: parseIntEnv(readEnv('REDIS_DB')),
    keyPrefix: readEnv('REDIS_KEY_PREFIX') || DEFAULT_PREFIX,
  };
}

function makeRedisClient(cfg: RedisConfig): Redis {
  if (cfg.url) return new Redis(cfg.url);
  return new Redis({
    host: cfg.host ?? 'localhost',
    port: cfg.port ?? 6379,
    password: cfg.password,
    db: cfg.db ?? 0,
  });
}

function attachEventHandlers(client: Redis): void {
  client.on('error', (err) => log.error('Connection error', { error: err }));
  client.on('connect', () => log.info('Connected successfully'));
}

class RedisCacheAdapter implements CacheAdapter {
  private readonly client: Redis;
  private readonly prefix: string;

  constructor(config: RedisConfig = {}) {
    this.prefix = config.keyPrefix || DEFAULT_PREFIX;
    this.client = makeRedisClient(config);
    attachEventHandlers(this.client);
  }

  private pk(key: string): string {
    return this.prefix + key;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(this.pk(key));
      return raw == null ? null : (JSON.parse(raw) as T);
    } catch (error) {
      log.error('Get error', { error });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const prefixed = this.pk(key);
    const serialized = JSON.stringify(value);
    try {
      if (ttlSeconds) {
        await this.client.setex(prefixed, ttlSeconds, serialized);
        return;
      }
      await this.client.set(prefixed, serialized);
    } catch (error) {
      log.error('Set error', { error });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(this.pk(key));
    } catch (error) {
      log.error('Delete error', { error });
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    const matchExpr = this.pk(pattern);
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', matchExpr, 'COUNT', SCAN_BATCH);
        if (keys.length > 0) await this.client.del(...keys);
        cursor = next;
      } while (cursor !== '0');
    } catch (error) {
      log.error('DeletePattern error', { error });
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return (await this.client.exists(this.pk(key))) === 1;
    } catch (error) {
      log.error('Has error', { error });
      return false;
    }
  }

  // Atomic counter for rate limiting: first hit in a window sets the TTL so the window expires on its own.
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    try {
      const prefixed = this.pk(key);
      const count = await this.client.incr(prefixed);
      if (count === 1) await this.client.expire(prefixed, ttlSeconds);
      return count;
    } catch (error) {
      log.error('IncrWithTtl error', { error });
      // Fail open: an unreachable Redis must not lock every user out.
      return 0;
    }
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const reply = await this.client.set(this.pk(key), '1', 'EX', ttlSeconds, 'NX');
      return reply === 'OK';
    } catch (error) {
      log.error('AcquireLock error', { error });
      return false;
    }
  }

  async releaseLock(key: string): Promise<void> {
    try {
      await this.client.del(this.pk(key));
    } catch (error) {
      log.error('ReleaseLock error', { error });
    }
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  getStatus(): string {
    return this.client.status;
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

let shared: RedisCacheAdapter | null = null;

export function getRedisCache(): RedisCacheAdapter {
  return (shared ??= new RedisCacheAdapter(envConfig()));
}

export function createRedisCache(config: RedisConfig): RedisCacheAdapter {
  return new RedisCacheAdapter(config);
}

export { RedisCacheAdapter };
