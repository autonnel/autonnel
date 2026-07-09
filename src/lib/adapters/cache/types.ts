export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<void>;
  has(key: string): Promise<boolean>;
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  releaseLock(key: string): Promise<void>;
}

export interface RedirectCacheData {
  targetUrl: string;
  funnelId: string;
  pageType: string;
  nextStepUrl: string | null;
  sourcePageId?: string;
}
