import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  userHasFeature: vi.fn(),
  canAccessPermissionsPageAsync: vi.fn(async () => false),
  findManyConnections: vi.fn(),
  findFirstRun: vi.fn(),
}));

vi.mock('@/lib/auth/middleware', () => ({ checkAuth: h.checkAuth }));
vi.mock('@/lib/rbac', () => ({
  FEATURES: { ANALYTICS: 'analytics', SETTINGS_ADS: 'settings_ads', PERMISSIONS: 'permissions' },
  userHasFeature: h.userHasFeature,
  canAccessPermissionsPageAsync: h.canAccessPermissionsPageAsync,
}));
vi.mock('@/modules/platform/infra/prisma-tenant-extension', () => ({
  getTenantPrisma: () => ({
    adAccountConnection: { findMany: h.findManyConnections },
    adSyncRun: { findFirst: h.findFirstRun },
  }),
}));

const { checkAuth, userHasFeature, findManyConnections, findFirstRun } = h;

import { GET } from './status';

const AUTH_USER = { id: 'u1', providerId: 'p1', email: 'a@b', username: 'a', name: null, avatar: null };

function ctx(): any {
  return { request: new Request('http://localhost/api/ads/sync/status'), locals: {} };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkAuth.mockResolvedValue({ authenticated: true, user: AUTH_USER, roles: [], features: [], accessibleNavIds: [] });
  userHasFeature.mockResolvedValue(true);
  findManyConnections.mockResolvedValue([]);
  findFirstRun.mockResolvedValue(null);
});

describe('GET /api/ads/sync/status', () => {
  it('rejects an unauthenticated request', async () => {
    checkAuth.mockResolvedValue({ authenticated: false, user: null, roles: [], features: [], accessibleNavIds: [] });
    const res = await GET(ctx());
    expect(res.status).toBe(401);
  });

  it('rejects a request without either ANALYTICS or SETTINGS_ADS', async () => {
    userHasFeature.mockResolvedValue(false);
    const res = await GET(ctx());
    expect(res.status).toBe(403);
  });

  it('allows a SETTINGS_ADS-only principal to poll status (the Settings -> Ads refresh button)', async () => {
    userHasFeature.mockImplementation(async (_userId: string, feature: string) => feature === 'settings_ads');
    const res = await GET(ctx());
    expect(res.status).toBe(200);
  });

  it('returns the latest run per connection, surfacing truncated and error as-is', async () => {
    findManyConnections.mockResolvedValue([
      { id: 'conn-1', platform: 'META' },
      { id: 'conn-2', platform: 'GOOGLE' },
    ]);
    findFirstRun.mockImplementation(async ({ where }: { where: { connectionId: string } }) => {
      if (where.connectionId === 'conn-1') {
        return {
          connectionId: 'conn-1',
          status: 'OK',
          startedAt: new Date('2026-09-12T10:00:00.000Z'),
          finishedAt: new Date('2026-09-12T10:01:00.000Z'),
          adsFetched: 5,
          daysUpserted: 3,
          truncated: true,
          error: null,
        };
      }
      return {
        connectionId: 'conn-2',
        status: 'FAILED',
        startedAt: new Date('2026-09-12T09:00:00.000Z'),
        finishedAt: new Date('2026-09-12T09:00:30.000Z'),
        adsFetched: 0,
        daysUpserted: 0,
        truncated: false,
        error: 'token expired',
      };
    });

    const res = await GET(ctx());
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.running).toBe(false);
    expect(body.lastRunAt).toBe('2026-09-12T10:00:00.000Z');
    expect(body.runs).toHaveLength(2);

    const conn1 = body.runs.find((r: { connectionId: string }) => r.connectionId === 'conn-1');
    expect(conn1).toMatchObject({ platform: 'META', status: 'OK', truncated: true, error: null });

    const conn2 = body.runs.find((r: { connectionId: string }) => r.connectionId === 'conn-2');
    expect(conn2).toMatchObject({ platform: 'GOOGLE', status: 'FAILED', truncated: false, error: 'token expired' });
  });

  it('reports running:true when any connection has a RUNNING row', async () => {
    findManyConnections.mockResolvedValue([{ id: 'conn-1', platform: 'META' }]);
    findFirstRun.mockResolvedValue({
      connectionId: 'conn-1',
      status: 'RUNNING',
      startedAt: new Date('2026-09-12T10:00:00.000Z'),
      finishedAt: null,
      adsFetched: 0,
      daysUpserted: 0,
      truncated: false,
      error: null,
    });
    const res = await GET(ctx());
    const body = (await res.json()) as any;
    expect(body.running).toBe(true);
    expect(body.runs[0].finishedAt).toBeNull();
  });

  it('omits connections that have never been synced', async () => {
    findManyConnections.mockResolvedValue([{ id: 'conn-1', platform: 'META' }]);
    findFirstRun.mockResolvedValue(null);
    const res = await GET(ctx());
    const body = (await res.json()) as any;
    expect(body.runs).toEqual([]);
    expect(body.lastRunAt).toBeNull();
    expect(body.running).toBe(false);
  });
});
