import { describe, it, expect, vi } from 'vitest';
import { GET } from './index';
import { runWithContext } from '@/modules/identity/infra/als-tenant-context';
import { PermissionSet } from '@/modules/identity/domain/permission-set';
import { toFeatureKey } from '@/modules/identity/domain/feature-key';
import { toTenantId } from '@/modules/shared-kernel/tenant-id';

vi.mock('@/composition/make-identity', () => ({
  makeIdentity: () => ({
    memberDirectory: {
      listMembers: vi.fn(async () => [
        { id: 'u1', email: 'a@b.com', name: null, avatar: null, roles: [{ id: 'r1', name: 'admin' }] },
      ]),
    },
  }),
}));

function ctx(): any {
  return { request: new Request('https://x/api/permissions'), locals: {} };
}

describe('GET /api/permissions', () => {
  it('returns 403 without the PERMISSIONS feature', async () => {
    const principal = { kind: 'user' as const, userId: 'u', tenantId: toTenantId('default'), permissions: PermissionSet.empty() };
    const res = await runWithContext({ tenantId: toTenantId('default'), principal }, async () => GET(ctx()));
    expect(res.status).toBe(403);
  });

  it('returns the feature catalog and members with the PERMISSIONS feature', async () => {
    const principal = { kind: 'user' as const, userId: 'u', tenantId: toTenantId('default'), permissions: PermissionSet.of([toFeatureKey('PERMISSIONS')]) };
    const res = await runWithContext({ tenantId: toTenantId('default'), principal }, async () => GET(ctx()));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { features: Array<{ id: string }>; users: Array<{ roles: Array<{ name: string }> }> };
    expect(Array.isArray(json.features)).toBe(true);
    expect(json.features.some((f) => f.id === 'PERMISSIONS')).toBe(true);
    expect(json.users[0].roles[0].name).toBe('admin');
  });
});
