import type { CacheAdapter } from './types';

const SWEEP_INTERVAL_MS = 60_000;

type ExpiresAt = number | null;

function expiresAt(ttlSeconds?: number): ExpiresAt {
  return ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
}

function isExpired(exp: ExpiresAt, now: number): boolean {
  return exp !== null && now > exp;
}

function patternToRegex(glob: string): RegExp {
  const safe = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${safe}$`);
}

class MemoryCacheAdapter implements CacheAdapter {
  private readonly store = new Map<string, unknown>();
  private readonly expiry = new Map<string, ExpiresAt>();
  private ticker: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.ticker = setInterval(() => this.evict(), SWEEP_INTERVAL_MS);
  }

  private remove(key: string): void {
    this.store.delete(key);
    this.expiry.delete(key);
  }

  private lookup<T>(key: string): T | null {
    if (!this.store.has(key)) return null;
    const exp = this.expiry.get(key) ?? null;
    if (isExpired(exp, Date.now())) {
      this.remove(key);
      return null;
    }
    return this.store.get(key) as T;
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, exp] of this.expiry) {
      if (isExpired(exp, now)) this.remove(key);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    return this.lookup<T>(key);
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.store.set(key, value);
    this.expiry.set(key, expiresAt(ttlSeconds));
  }

  async delete(key: string): Promise<void> {
    this.remove(key);
  }

  async deletePattern(pattern: string): Promise<void> {
    const re = patternToRegex(pattern);
    for (const key of [...this.store.keys()]) {
      if (re.test(key)) this.remove(key);
    }
  }

  async has(key: string): Promise<boolean> {
    return this.lookup(key) !== null;
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    if (this.lookup(key) !== null) return false;
    await this.set(key, true, ttlSeconds);
    return true;
  }

  async releaseLock(key: string): Promise<void> {
    this.remove(key);
  }

  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
    this.expiry.clear();
  }

  destroy(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
    this.clear();
  }
}

let singleton: MemoryCacheAdapter | null = null;

export function getMemoryCache(): MemoryCacheAdapter {
  return (singleton ??= new MemoryCacheAdapter());
}

export { MemoryCacheAdapter };
