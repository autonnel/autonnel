import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runWithContext } from '@/modules/identity/infra/als-tenant-context';
import { PermissionSet } from '@/modules/identity/domain/permission-set';
import { toFeatureKey } from '@/modules/identity/domain/feature-key';
import { toTenantId } from '@/modules/shared-kernel/tenant-id';

const mocks = vi.hoisted(() => ({
  unbind: vi.fn(),
}));

vi.mock('@/composition/make-ads-deps', () => ({
  createAdsDepsForRequest: vi.fn(async () => ({})),
}));

vi.mock('@/composition/make-acquisition-ads', () => ({
  makeAcquisitionAds: vi.fn(async () => ({
    funnelBindingRepo: { unbind: mocks.unbind },
  })),
}));

import { DELETE } from '@/pages/api/funnel/[id]/ads';

const principal = {
  kind: 'user' as const,
  userId: 'u1',
  tenantId: toTenantId('default'),
  permissions: PermissionSet.of([toFeatureKey('FUNNELS')]),
};

function run(funnelId: string, body: unknown): Promise<Response> {
  const ctx = {
    params: { id: funnelId },
    request: new Request(`https://admin.example/api/funnel/${funnelId}/ads`, {
      method: 'DELETE',
      body: JSON.stringify(body),
    }),
    locals: {},
  };
  return runWithContext({ tenantId: toTenantId('default'), principal }, async () => (DELETE as any)(ctx));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DELETE /api/funnel/:id/ads', () => {
  it('unbinds only the requested funnel + connection (tenant scoping enforced by the repo)', async () => {
    mocks.unbind.mockResolvedValueOnce(undefined);

    const res = await run('funnel_1', { connectionId: 'connection_1' });

    expect(res.status).toBe(200);
    expect(mocks.unbind).toHaveBeenCalledWith('funnel_1', 'connection_1');
  });

  it('returns 400 when connectionId is missing', async () => {
    const res = await run('funnel_1', {});

    expect(res.status).toBe(400);
    expect(mocks.unbind).not.toHaveBeenCalled();
  });
});
