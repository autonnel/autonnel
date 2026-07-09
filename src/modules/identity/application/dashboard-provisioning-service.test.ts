import { describe, it, expect, vi } from 'vitest';
import { DashboardProvisioningService } from './dashboard-provisioning-service';
import { RolePolicy } from '../domain/role-policy';
import { TenantMembership } from '../domain/tenant-membership';

function deps() {
  return {
    registration: { register: vi.fn().mockResolvedValue({ userId: 'u1', created: true }) },
    memberships: {
      findByUserAndTenant: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
      listByUser: vi.fn(), listByTenant: vi.fn(), countActiveOwners: vi.fn(),
    },
    roles: {
      listByTenant: vi.fn().mockResolvedValue([]),
      save: vi.fn(), findById: vi.fn(), delete: vi.fn(),
    },
    catalog: { allKeys: () => new Set(['ORDERS', 'PAYMENT']) },
  };
}

function svc(d: ReturnType<typeof deps>) {
  return new DashboardProvisioningService(d.registration as any, d.memberships as any, d.roles as any, d.catalog as any);
}

describe('DashboardProvisioningService', () => {
  it('registers the user and returns the registration result', async () => {
    const d = deps();
    const result = await svc(d).provisionAdmin({ email: 'a@b.com', password: 'secret123' });
    expect(d.registration.register).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret123' });
    expect(result).toEqual({ userId: 'u1', created: true });
  });

  it('creates a full-access Admin role and an admin membership when none exist', async () => {
    const d = deps();
    await svc(d).provisionAdmin({ email: 'a@b.com', password: 'secret123' });

    expect(d.roles.save).toHaveBeenCalledTimes(1);
    const savedRole = d.roles.save.mock.calls[0][0] as RolePolicy;
    expect(savedRole.name.toLowerCase()).toBe('admin');
    expect(savedRole.grants().map(String).sort()).toEqual(['ORDERS', 'PAYMENT']);

    expect(d.memberships.save).toHaveBeenCalledTimes(1);
    const savedMembership = d.memberships.save.mock.calls[0][0] as TenantMembership;
    expect(savedMembership.roleIds).toEqual([savedRole.id]);
  });

  it('reuses an existing admin role instead of creating one', async () => {
    const d = deps();
    const admin = RolePolicy.create({ id: 'admin-1', name: 'admin', isSystem: true, grants: [] });
    d.roles.listByTenant.mockResolvedValue([admin]);

    await svc(d).provisionAdmin({ email: 'a@b.com', password: 'secret123' });

    expect(d.roles.save).not.toHaveBeenCalled();
    const savedMembership = d.memberships.save.mock.calls[0][0] as TenantMembership;
    expect(savedMembership.roleIds).toEqual(['admin-1']);
  });

  it('grants the admin role onto an existing membership', async () => {
    const d = deps();
    const existing = TenantMembership.create({ id: 'm1', userId: 'u1', roleIds: [] });
    const assignSpy = vi.spyOn(existing, 'assignRoles');
    d.memberships.findByUserAndTenant.mockResolvedValue(existing);

    await svc(d).provisionAdmin({ email: 'a@b.com', password: 'secret123' });

    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(d.memberships.save).toHaveBeenCalledWith(existing);
  });
});
