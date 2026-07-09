import { describe, it, expect, vi } from 'vitest';
import { RoleDashboardService } from './role-dashboard-service';
import { RolePolicy } from '../domain/role-policy';
import { toFeatureKey } from '../domain/feature-key';

function deps() {
  const custom = RolePolicy.create({ id: 'r1', name: 'editor', isSystem: false, grants: [toFeatureKey('ORDERS')] });
  const system = RolePolicy.create({ id: 'admin', name: 'admin', isSystem: true, grants: [toFeatureKey('ORDERS')] });
  return {
    roles: {
      listByTenant: vi.fn().mockResolvedValue([custom, system]),
      findById: vi.fn(async (id: string) => (id === 'admin' ? system : custom)),
      save: vi.fn(), delete: vi.fn(),
    },
    catalog: { allKeys: () => new Set(['ORDERS', 'PAYMENT']) },
    events: { publish: vi.fn() },
  };
}

describe('RoleDashboardService', () => {
  it('drops unknown FEATURES keys when updating grants', async () => {
    const d = deps();
    const svc = new RoleDashboardService(d.roles as any, d.catalog as any, d.events as any);
    await svc.updateRoleGrants('r1', ['PAYMENT', 'NOPE']);
    const saved = d.roles.save.mock.calls[0][0] as RolePolicy;
    expect(saved.grants().map(String).sort()).toEqual(['PAYMENT']);
  });

  it('refuses to edit a system role', async () => {
    const d = deps();
    const svc = new RoleDashboardService(d.roles as any, d.catalog as any, d.events as any);
    await expect(svc.updateRoleGrants('admin', ['PAYMENT'])).rejects.toThrow(/system/i);
    expect(d.roles.save).not.toHaveBeenCalled();
  });
});
