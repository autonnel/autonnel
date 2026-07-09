export * from './types';
export { CacheRateLimiter } from './cache-rate-limiter';

import { getCache } from '@/lib/adapters/cache';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { CacheRateLimiter } from './cache-rate-limiter';
import type { RateLimiter, RateLimitResult } from './types';

let limiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  return (limiter ??= new CacheRateLimiter(getCache()));
}

export function setRateLimiter(impl: RateLimiter): void {
  limiter = impl;
}

// Tenant-scoped so per-tenant abuse can't exhaust another tenant's budget on shared infra.
export function rateLimitKey(scope: string, ...parts: string[]): string {
  return [getCurrentTenantId(), scope, ...parts].join(':');
}

export const RATE_LIMITS = {
  LOGIN_PER_IDENTIFIER: { limit: 5, windowSeconds: 15 * 60 },
  LOGIN_PER_IP: { limit: 30, windowSeconds: 15 * 60 },
  ORDER_TRACKING_PER_IP: { limit: 20, windowSeconds: 10 * 60 },
  ORDER_TRACKING_PER_EMAIL: { limit: 10, windowSeconds: 10 * 60 },
} as const;

export type RateLimitRule = { limit: number; windowSeconds: number };

export async function enforceRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  return getRateLimiter().consume(key, rule.limit, rule.windowSeconds);
}
