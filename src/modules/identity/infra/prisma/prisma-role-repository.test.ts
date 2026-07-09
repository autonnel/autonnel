import { describe, it, expect } from 'vitest';
import { PrismaRoleRepository } from './prisma-role-repository';
import type { FeatureCatalogPort } from '../../application/ports/outbound';

const catalog: FeatureCatalogPort = {
  allKeys: () => new Set(['ORDERS', 'SETTINGS', 'SETTINGS_LOCALIZATION', 'PERMISSIONS']),
};

function dbWith(rows: any[]) {
  return {
    role: {
      findMany: async () => rows,
      findFirst: async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null,
      upsert: async () => undefined,
      delete: async () => undefined,
    },
  };
}

const adminRow = { id: 'r-admin', name: 'Admin', description: null, isSystem: true, grants: ['ORDERS'] };
const customRow = { id: 'r-ops', name: 'Ops', description: null, isSystem: false, grants: ['ORDERS', 'SETTINGS'] };

describe('PrismaRoleRepository dynamic admin grants', () => {
  it('Admin system role resolves to the full catalog regardless of stored grants', async () => {
    const repo = new PrismaRoleRepository(dbWith([adminRow]) as any, catalog);
    const [admin] = await repo.listByTenant();
    const keys = admin.grants().map(String).sort();
    expect(keys).toEqual(['ORDERS', 'PERMISSIONS', 'SETTINGS', 'SETTINGS_LOCALIZATION']);
    // the new sub-feature is present even though the stored grants[] only had ORDERS
    expect(keys).toContain('SETTINGS_LOCALIZATION');
  });

  it('non-admin roles keep their stored grants', async () => {
    const repo = new PrismaRoleRepository(dbWith([customRow]) as any, catalog);
    const [ops] = await repo.listByTenant();
    expect(ops.grants().map(String).sort()).toEqual(['ORDERS', 'SETTINGS']);
  });

  it('a non-system role named "Admin" does NOT get full access', async () => {
    const fakeAdmin = { ...adminRow, isSystem: false, grants: ['ORDERS'] };
    const repo = new PrismaRoleRepository(dbWith([fakeAdmin]) as any, catalog);
    const [r] = await repo.listByTenant();
    expect(r.grants().map(String)).toEqual(['ORDERS']);
  });

  it('without a catalog, the Admin role falls back to stored grants (backward compatible)', async () => {
    const repo = new PrismaRoleRepository(dbWith([adminRow]) as any);
    const [admin] = await repo.listByTenant();
    expect(admin.grants().map(String)).toEqual(['ORDERS']);
  });

  it('findById applies the same dynamic-admin rule', async () => {
    const repo = new PrismaRoleRepository(dbWith([adminRow]) as any, catalog);
    const admin = await repo.findById('r-admin');
    expect(admin?.grants().map(String)).toContain('SETTINGS_LOCALIZATION');
  });
});
