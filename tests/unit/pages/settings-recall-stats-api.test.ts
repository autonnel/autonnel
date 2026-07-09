import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runWithContext } from '@/modules/identity/infra/als-tenant-context';
import { PermissionSet } from '@/modules/identity/domain/permission-set';
import { toFeatureKey } from '@/modules/identity/domain/feature-key';
import { toTenantId } from '@/modules/shared-kernel/tenant-id';

const { getRecallStatsMock } = vi.hoisted(() => ({
  getRecallStatsMock: vi.fn(),
}));

vi.mock('@/lib/services/recall-stats.service', () => ({
  getRecallStats: getRecallStatsMock,
}));

import { GET } from '@/pages/api/settings/recall/stats';

const TENANT = toTenantId('default');

type MaybePrincipal = ReturnType<typeof principalWith> | null;

function principalWith(features: string[]) {
  return {
    kind: 'user' as const,
    userId: 'u1',
    tenantId: TENANT,
    permissions: PermissionSet.of(features.map(toFeatureKey)),
  };
}

function run(url: string, principal: MaybePrincipal): Promise<Response> {
  const ctx = { request: new Request(url), params: {}, locals: {} };
  return runWithContext({ tenantId: TENANT, principal }, async () => (GET as any)(ctx));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/settings/recall/stats', () => {
  it('rejects unauthenticated requests with 403', async () => {
    const res = await run('http://x/api/settings/recall/stats', null);
    expect(res.status).toBe(403);
    expect(getRecallStatsMock).not.toHaveBeenCalled();
  });

  it('returns 403 when no recall feature access', async () => {
    const res = await run('http://x/api/settings/recall/stats', principalWith([]));
    expect(res.status).toBe(403);
    expect(getRecallStatsMock).not.toHaveBeenCalled();
  });

  it('returns service payload as JSON for valid range', async () => {
    getRecallStatsMock.mockResolvedValue({
      range: '7d', emailsSent: 100, ordersRecovered: 5, recoveryRate: 0.05,
    });
    const res = await run('http://x/api/settings/recall/stats?range=7d', principalWith(['SETTINGS_RECALL']));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ range: '7d', emailsSent: 100, ordersRecovered: 5, recoveryRate: 0.05 });
    expect(getRecallStatsMock).toHaveBeenCalledWith('7d');
  });

  it('falls back to 30d when range is missing', async () => {
    getRecallStatsMock.mockResolvedValue({ range: '30d', emailsSent: 0, ordersRecovered: 0, recoveryRate: null });
    await run('http://x/api/settings/recall/stats', principalWith(['SETTINGS_RECALL']));
    expect(getRecallStatsMock).toHaveBeenCalledWith('30d');
  });

  it('falls back to 30d when range is invalid', async () => {
    getRecallStatsMock.mockResolvedValue({ range: '30d', emailsSent: 0, ordersRecovered: 0, recoveryRate: null });
    await run('http://x/api/settings/recall/stats?range=garbage', principalWith(['SETTINGS_RECALL']));
    expect(getRecallStatsMock).toHaveBeenCalledWith('30d');
  });

  it('accepts all four valid ranges', async () => {
    getRecallStatsMock.mockResolvedValue({ range: 'all', emailsSent: 0, ordersRecovered: 0, recoveryRate: null });
    for (const r of ['7d', '30d', '90d', 'all']) {
      await run(`http://x/api/settings/recall/stats?range=${r}`, principalWith(['SETTINGS_RECALL']));
    }
    expect(getRecallStatsMock.mock.calls.map((c) => c[0])).toEqual(['7d', '30d', '90d', 'all']);
  });

  it('returns 500 on service error', async () => {
    getRecallStatsMock.mockRejectedValue(new Error('db down'));
    const res = await run('http://x/api/settings/recall/stats?range=30d', principalWith(['SETTINGS_RECALL']));
    expect(res.status).toBe(500);
  });
});
