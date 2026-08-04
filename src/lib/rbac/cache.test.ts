import { describe, it, expect, vi } from 'vitest';

const store = new Map<string, unknown>();
const deleted: string[] = [];
const patterns: string[] = [];

vi.mock('@/lib/adapters/cache', () => ({
  getCache: () => ({
    get: async (k: string) => (store.has(k) ? store.get(k) : null),
    set: async (k: string, v: unknown) => void store.set(k, v),
    delete: async (k: string) => {
      deleted.push(k);
      store.delete(k);
    },
    deletePattern: async (p: string) => void patterns.push(p),
  }),
  CACHE_TTL: { SHORT: 300 },
}));

let currentTenant = 'tenant-a';
vi.mock('@/lib/tenant/context', () => ({ getCurrentTenantId: () => currentTenant }));

import {
  buildUserRolesCacheKey,
  buildUserFeaturesCacheKey,
  invalidateUserRolesCache,
  invalidateAllPermissionCaches,
} from './cache';

describe('rbac cache keys are tenant-scoped', () => {
  it('produces different role keys for the same user in different tenants', () => {
    currentTenant = 'tenant-a';
    const a = buildUserRolesCacheKey('u1');
    currentTenant = 'tenant-b';
    const b = buildUserRolesCacheKey('u1');
    expect(a).not.toBe(b);
    expect(a).toContain('tenant-a');
    expect(b).toContain('tenant-b');
  });

  it('produces different feature keys for the same user in different tenants', () => {
    currentTenant = 'tenant-a';
    const a = buildUserFeaturesCacheKey('u1');
    currentTenant = 'tenant-b';
    const b = buildUserFeaturesCacheKey('u1');
    expect(a).not.toBe(b);
  });

  it('invalidation targets only the current tenant entries', async () => {
    deleted.length = 0;
    currentTenant = 'tenant-b';
    await invalidateUserRolesCache('u1');
    expect(deleted).toEqual([buildUserRolesCacheKey('u1'), buildUserFeaturesCacheKey('u1')]);
    expect(deleted.every((k) => k.includes('tenant-b'))).toBe(true);
  });

  it('the global purge still clears every tenant', async () => {
    patterns.length = 0;
    await invalidateAllPermissionCaches();
    expect(patterns).toEqual(['perm:roles:*', 'perm:features:*']);
  });
});
