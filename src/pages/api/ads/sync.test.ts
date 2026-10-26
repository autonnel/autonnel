import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  userHasFeature: vi.fn(),
  canAccessPermissionsPageAsync: vi.fn(async () => false),
  findFirst: vi.fn(),
  enforceRateLimit: vi.fn(),
  beginManualAdInsightsSync: vi.fn(),
}));

vi.mock('@/lib/auth/middleware', () => ({ checkAuth: h.checkAuth }));
vi.mock('@/lib/rbac', () => ({
  FEATURES: { ANALYTICS: 'analytics', SETTINGS_ADS: 'settings_ads', PERMISSIONS: 'permissions' },
  userHasFeature: h.userHasFeature,
  canAccessPermissionsPageAsync: h.canAccessPermissionsPageAsync,
}));
vi.mock('@/modules/platform/infra/prisma-tenant-extension', () => ({
  getTenantPrisma: () => ({ adAccountConnection: { findFirst: h.findFirst } }),
}));
vi.mock('@/lib/adapters/rate-limit', () => ({
  enforceRateLimit: h.enforceRateLimit,
  rateLimitKey: (...parts: string[]) => parts.join(':'),
  RATE_LIMITS: { ADS_INSIGHTS_MANUAL_REFRESH: { limit: 1, windowSeconds: 60 } },
}));
vi.mock('@/composition/trigger-manual-ad-insights-sync', () => ({
  beginManualAdInsightsSync: h.beginManualAdInsightsSync,
}));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }),
}));

const { checkAuth, userHasFeature, findFirst, enforceRateLimit, beginManualAdInsightsSync } = h;

import { POST } from './sync';

const AUTH_USER = { id: 'u1', providerId: 'p1', email: 'a@b', username: 'a', name: null, avatar: null };

function ctx(body?: unknown): any {
  const init: RequestInit =
    body === undefined
      ? { method: 'POST' }
      : { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } };
  return { request: new Request('http://localhost/api/ads/sync', init), locals: {} };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkAuth.mockResolvedValue({ authenticated: true, user: AUTH_USER, roles: [], features: [], accessibleNavIds: [] });
  userHasFeature.mockResolvedValue(true);
  findFirst.mockResolvedValue({ id: 'conn-1' });
  enforceRateLimit.mockResolvedValue({ allowed: true, remaining: 0, retryAfterSeconds: 0 });
  beginManualAdInsightsSync.mockResolvedValue(true);
});

describe('POST /api/ads/sync', () => {
  it('rejects an unauthenticated request without starting anything', async () => {
    checkAuth.mockResolvedValue({ authenticated: false, user: null, roles: [], features: [], accessibleNavIds: [] });
    const res = await POST(ctx());
    expect(res.status).toBe(401);
    expect(beginManualAdInsightsSync).not.toHaveBeenCalled();
  });

  it('rejects a request without either ANALYTICS or SETTINGS_ADS', async () => {
    userHasFeature.mockResolvedValue(false);
    const res = await POST(ctx());
    expect(res.status).toBe(403);
    expect(beginManualAdInsightsSync).not.toHaveBeenCalled();
  });

  it('allows a SETTINGS_ADS-only principal to start a refresh (the Settings -> Ads refresh button)', async () => {
    userHasFeature.mockImplementation(async (_userId: string, feature: string) => feature === 'settings_ads');
    const res = await POST(ctx({ connectionId: 'conn-1' }));
    expect(res.status).toBe(200);
    expect(beginManualAdInsightsSync).toHaveBeenCalledWith({ locals: {}, connectionId: 'conn-1' });
  });

  it('triggers a full-tenant sync when no connectionId is given', async () => {
    const res = await POST(ctx({}));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toEqual({ started: true, scope: 'all' });
    expect(findFirst).not.toHaveBeenCalled();
    expect(beginManualAdInsightsSync).toHaveBeenCalledWith({ locals: {}, connectionId: undefined });
  });

  it('triggers a single-connection sync when connectionId is given and owned by this tenant', async () => {
    const res = await POST(ctx({ connectionId: 'conn-1' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toEqual({ started: true, scope: 'connection' });
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'conn-1' }, select: { id: true } });
    expect(beginManualAdInsightsSync).toHaveBeenCalledWith({ locals: {}, connectionId: 'conn-1' });
  });

  it('returns a generic 404 for a connection that does not belong to this tenant, leaking nothing about it', async () => {
    findFirst.mockResolvedValue(null);
    const res = await POST(ctx({ connectionId: 'foreign-conn' }));
    expect(res.status).toBe(404);
    const rawBody = await res.text();
    expect(rawBody).not.toContain('foreign-conn');
    expect(JSON.parse(rawBody)).toEqual({ error: 'Not found' });
    expect(beginManualAdInsightsSync).not.toHaveBeenCalled();
  });

  it('returns the same generic 404 for a connectionId that does not exist at all', async () => {
    findFirst.mockResolvedValue(null);
    const res = await POST(ctx({ connectionId: 'does-not-exist' }));
    expect(res.status).toBe(404);
    expect(beginManualAdInsightsSync).not.toHaveBeenCalled();
  });

  it('returns 429 with retryAfterSeconds and Retry-After during cooldown, and never starts a sync', async () => {
    enforceRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 42 });
    const res = await POST(ctx({}));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    const body = (await res.json()) as any;
    expect(body.retryAfterSeconds).toBe(42);
    expect(body.started).toBeUndefined();
    expect(beginManualAdInsightsSync).not.toHaveBeenCalled();
  });

  it('returns 429 without claiming success when the shared sync lock is already held', async () => {
    beginManualAdInsightsSync.mockResolvedValue(false);
    const res = await POST(ctx({}));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    const body = (await res.json()) as any;
    expect(body.started).toBeUndefined();
    expect(typeof body.retryAfterSeconds).toBe('number');
  });
});
