import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  verifyCalls: 0,
  allow: true,
  enforced: [] as string[],
}));

vi.mock('@/lib/auth/password', () => ({
  verifyPassword: async () => {
    h.verifyCalls += 1;
    return false;
  },
}));
vi.mock('@/lib/config/keys', () => ({
  getMaintenanceConfig: async () => ({ enabled: true, passwordHash: '$2a$10$fakehash' }),
}));
vi.mock('@/lib/auth/maintenance-unlock-token', () => ({ createMaintenanceUnlockToken: async () => 'tok' }));
vi.mock('@/lib/api/client-ip', () => ({ getClientIp: () => '1.2.3.4' }));
vi.mock('@/lib/adapters/rate-limit', () => ({
  rateLimitKey: (scope: string, ...parts: string[]) => [scope, ...parts].join(':'),
  enforceRateLimit: async (key: string) => {
    h.enforced.push(key);
    return h.allow
      ? { allowed: true, remaining: 4, retryAfterSeconds: 0 }
      : { allowed: false, remaining: 0, retryAfterSeconds: 900 };
  },
  RATE_LIMITS: {
    MAINTENANCE_UNLOCK_PER_IP: { limit: 5, windowSeconds: 900 },
    MAINTENANCE_UNLOCK_GLOBAL: { limit: 60, windowSeconds: 900 },
  },
}));

import { POST } from '../maintenance-unlock';

function ctx(password: string) {
  return {
    request: new Request('http://shop.test/api/shop/maintenance-unlock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    }),
    url: new URL('http://shop.test/api/shop/maintenance-unlock'),
    redirect: (location: string, status: number) =>
      new Response(null, { status, headers: { Location: location } }),
  } as never;
}

beforeEach(() => {
  h.verifyCalls = 0;
  h.allow = true;
  h.enforced = [];
});

describe('POST /api/shop/maintenance-unlock — throttling', () => {
  it('never reaches bcrypt when throttled', async () => {
    h.allow = false;
    const res = await POST(ctx('guess'));
    expect(res.status).toBe(429);
    expect(h.verifyCalls).toBe(0);
  });

  it('sets retry-after when throttled', async () => {
    h.allow = false;
    const res = await POST(ctx('guess'));
    expect(res.headers.get('retry-after')).toBe('900');
  });

  it('throttles per IP and globally', async () => {
    await POST(ctx('guess'));
    expect(h.enforced).toEqual(['maintenance:unlock:ip:1.2.3.4', 'maintenance:unlock:global']);
  });

  it('does not consume a limit slot for an empty password', async () => {
    const res = await POST(ctx(''));
    expect(h.enforced).toEqual([]);
    expect(h.verifyCalls).toBe(0);
    expect(res.status).toBe(303);
  });

  it('verifies once when allowed', async () => {
    await POST(ctx('guess'));
    expect(h.verifyCalls).toBe(1);
  });
});
