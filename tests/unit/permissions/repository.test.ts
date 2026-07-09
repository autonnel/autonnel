import { describe, it, expect, vi, beforeEach } from 'vitest';

// Current model exercised here:
//  - Prisma is resolved via getBasePrisma() (not a `prisma` singleton).
//  - A role's features live in the `grants` array column on Role (no roleFeature join table);
//    setRoleFeatures replaces that array atomically via a single tenant-scoped updateMany.
//  - Admin + role assignment live in Membership.roleIds (no User.isAdmin column, no userRole
//    join table). "Admin" = the tenant's system Role named VIRTUAL_ADMIN_ROLE_NAME ('Admin').
//  - The virtual admin id ('__admin__') passed to setUserRoles is resolved to that tenant
//    Role's real id (created on demand) before being stored in Membership.roleIds.
const mocks = vi.hoisted(() => {
  const mockRole = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const mockMembership = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  };
  const mockUser = { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() };
  // Legacy surfaces kept only so the mock stays permissive; the current repository no longer touches them.
  const mockRoleFeature = { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() };
  const mockUserRole = { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() };
  const mockPrisma: any = {
    role: mockRole,
    membership: mockMembership,
    user: mockUser,
    roleFeature: mockRoleFeature,
    userRole: mockUserRole,
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
  };
  const cacheInvalidateAll = vi.fn(async () => undefined);
  const cacheInvalidateUser = vi.fn(async () => undefined);
  return { mockPrisma, mockRole, mockMembership, mockUser, mockRoleFeature, mockUserRole, cacheInvalidateAll, cacheInvalidateUser };
});

vi.mock('@/lib/db', () => ({
  getBasePrisma: () => mocks.mockPrisma,
  prisma: mocks.mockPrisma,
  createStandalonePrisma: () => mocks.mockPrisma,
}));

vi.mock('@/lib/rbac/cache', () => ({
  invalidateAllPermissionCaches: mocks.cacheInvalidateAll,
  invalidateUserRolesCache: mocks.cacheInvalidateUser,
  buildUserRolesCacheKey: (id: string) => `perm:roles:${id}`,
  buildUserFeaturesCacheKey: (id: string) => `perm:features:${id}`,
}));

import { PrismaPermissionRepository } from '@/lib/rbac/repository';

describe('PrismaPermissionRepository', () => {
  let repo: PrismaPermissionRepository;
  const { mockRole, mockMembership, cacheInvalidateAll, cacheInvalidateUser } = mocks;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PrismaPermissionRepository();
    // Safe baselines: no admin role in the tenant, no membership, empty role list.
    mockRole.findUnique.mockResolvedValue(null);
    mockRole.findFirst.mockResolvedValue(null);
    mockRole.findMany.mockResolvedValue([]);
    mockMembership.findUnique.mockResolvedValue(null);
    mockMembership.upsert.mockResolvedValue({});
  });

  it('createRole inserts a non-system role and invalidates cache', async () => {
    mockRole.create.mockResolvedValue({ id: 'r1', name: 'svc', description: null, isSystem: false });
    const r = await repo.createRole({ name: 'svc' });
    expect(mockRole.create).toHaveBeenCalledWith({
      data: { tenantId: 'default', name: 'svc', description: null, isSystem: false },
    });
    expect(r.id).toBe('r1');
    expect(cacheInvalidateAll).toHaveBeenCalledTimes(1);
  });

  it('updateRole on a system role rejects name change', async () => {
    mockRole.findFirst.mockResolvedValue({ id: 'r1', name: 'svc', isSystem: true });
    await expect(repo.updateRole('r1', { name: 'super_admin' })).rejects.toThrow(/system role/i);
    expect(mockRole.updateMany).not.toHaveBeenCalled();
    expect(cacheInvalidateAll).not.toHaveBeenCalled();
  });

  it('updateRole on a system role allows description change', async () => {
    mockRole.findFirst
      .mockResolvedValueOnce({ id: 'r1', name: 'svc', isSystem: true })
      .mockResolvedValueOnce({ id: 'r1', name: 'svc', description: 'New', isSystem: true });
    mockRole.updateMany.mockResolvedValue({ count: 1 });
    const r = await repo.updateRole('r1', { description: 'New' });
    expect(mockRole.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', tenantId: 'default' },
      data: { description: 'New' },
    });
    expect(r.description).toBe('New');
    expect(cacheInvalidateAll).toHaveBeenCalledTimes(1);
  });

  it('deleteRole refuses to delete a system role', async () => {
    mockRole.findFirst.mockResolvedValue({ id: 'r1', name: 'svc', isSystem: true });
    await expect(repo.deleteRole('r1')).rejects.toThrow(/system roles cannot be deleted/i);
    expect(mockRole.deleteMany).not.toHaveBeenCalled();
    expect(cacheInvalidateAll).not.toHaveBeenCalled();
  });

  it('deleteRole removes a non-system role and invalidates cache', async () => {
    mockRole.findFirst.mockResolvedValue({ id: 'r2', name: 'svc', isSystem: false });
    mockRole.deleteMany.mockResolvedValue({ count: 1 });
    await repo.deleteRole('r2');
    expect(mockRole.deleteMany).toHaveBeenCalledWith({ where: { id: 'r2', tenantId: 'default' } });
    expect(cacheInvalidateAll).toHaveBeenCalledTimes(1);
  });

  it('setRoleFeatures replaces the role grants array atomically and invalidates cache', async () => {
    mockRole.updateMany.mockResolvedValue({ count: 1 });
    await repo.setRoleFeatures('r1', ['orders', 'orders.view'] as any);
    expect(mockRole.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', tenantId: 'default' },
      data: { grants: ['orders', 'orders.view'] },
    });
    expect(cacheInvalidateAll).toHaveBeenCalledTimes(1);
  });

  it('setRoleFeatures with empty array clears the grants', async () => {
    mockRole.updateMany.mockResolvedValue({ count: 1 });
    await repo.setRoleFeatures('r1', [] as any);
    expect(mockRole.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', tenantId: 'default' },
      data: { grants: [] },
    });
    expect(cacheInvalidateAll).toHaveBeenCalledTimes(1);
  });

  it('setRoleFeatures dedupes input', async () => {
    mockRole.updateMany.mockResolvedValue({ count: 1 });
    await repo.setRoleFeatures('r1', ['orders', 'orders'] as any);
    const args = mockRole.updateMany.mock.calls[0][0];
    expect(args.data.grants).toEqual(['orders']);
  });

  it('assignUserRole merges the role into membership roleIds and invalidates per-user cache', async () => {
    mockRole.findFirst.mockResolvedValue({ id: 'r1' });
    mockMembership.findUnique.mockResolvedValue({ roleIds: [] });
    await repo.assignUserRole('u1', 'r1');
    expect(mockMembership.upsert).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: 'default', userId: 'u1' } },
      create: { tenantId: 'default', userId: 'u1', roleIds: ['r1'], status: 'active' },
      update: { roleIds: ['r1'] },
    });
    expect(cacheInvalidateUser).toHaveBeenCalledWith('u1');
  });

  it('setUserRoles with custom role ids writes membership roleIds and clears admin', async () => {
    mockRole.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
    await repo.setUserRoles('u1', ['r1', 'r2']);
    expect(mockRole.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['r1', 'r2'] }, tenantId: 'default' },
      select: { id: true },
    });
    // No admin role id present in the stored set → admin cleared.
    expect(mockMembership.upsert).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: 'default', userId: 'u1' } },
      create: { tenantId: 'default', userId: 'u1', roleIds: ['r1', 'r2'], status: 'active' },
      update: { roleIds: ['r1', 'r2'] },
    });
    expect(cacheInvalidateUser).toHaveBeenCalledWith('u1');
  });

  it('setUserRoles with the virtual admin id resolves it to the tenant Admin role and grants admin', async () => {
    mockRole.findMany.mockResolvedValue([{ id: 'r1' }]);
    mockRole.findUnique.mockResolvedValue({ id: 'admin-role-id' }); // ensureAdminRoleId → existing Admin role
    await repo.setUserRoles('u1', ['__admin__', 'r1']);
    expect(mockRole.findUnique).toHaveBeenCalledWith({
      where: { tenantId_name: { tenantId: 'default', name: 'Admin' } },
      select: { id: true },
    });
    const args = mockMembership.upsert.mock.calls[0][0];
    expect(args.update.roleIds).toEqual(['r1', 'admin-role-id']);
    // The virtual sentinel is never persisted; it is resolved to the real Admin role id.
    expect(args.update.roleIds).not.toContain('__admin__');
    expect(cacheInvalidateUser).toHaveBeenCalledWith('u1');
  });

  it('isUserAdmin is true when membership roleIds include the tenant Admin role', async () => {
    mockRole.findUnique.mockResolvedValue({ id: 'admin-role-id' });
    mockMembership.findUnique.mockResolvedValue({ roleIds: ['admin-role-id'] });
    expect(await repo.isUserAdmin('u1')).toBe(true);
    expect(mockRole.findUnique).toHaveBeenCalledWith({
      where: { tenantId_name: { tenantId: 'default', name: 'Admin' } },
      select: { id: true },
    });
    expect(mockMembership.findUnique).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: 'default', userId: 'u1' } },
      select: { roleIds: true },
    });
  });

  it('getUserRoleNames returns the virtual admin name when the user is admin', async () => {
    mockRole.findUnique.mockResolvedValue({ id: 'admin-role-id' });
    mockMembership.findUnique.mockResolvedValue({ roleIds: ['admin-role-id'] });
    const names = await repo.getUserRoleNames('u1');
    expect(names).toEqual(['Admin']);
    // Admin short-circuits before loading the individual role rows.
    expect(mockRole.findMany).not.toHaveBeenCalled();
  });

  it('getUserRoleNames returns membership role names when the user is not admin', async () => {
    mockRole.findUnique.mockResolvedValue(null); // no admin role in tenant → not admin
    mockMembership.findUnique.mockResolvedValue({ roleIds: ['rc', 'rb'] });
    mockRole.findMany.mockResolvedValue([
      { id: 'rc', name: 'cs' },
      { id: 'rb', name: 'beta' },
    ]);
    const names = await repo.getUserRoleNames('u1');
    expect(names).toEqual(['cs', 'beta']);
  });
});
