export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window resets (0 when allowed and a fresh window may be open). */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  /**
   * Count one hit against `key` within a fixed `windowSeconds` window allowing at most `limit` hits.
   * Counting still happens when the limit is exceeded so sustained abuse keeps the window pinned open.
   */
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}
