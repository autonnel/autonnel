import { describe, it, expect, beforeEach } from 'vitest';
import { setCache } from '@/lib/adapters/cache';
import { MemoryCacheAdapter } from '@/lib/adapters/cache/memory';
import {
  buildUserRolesCacheKey,
  buildUserFeaturesCacheKey,
  invalidateUserRolesCache,
  invalidateAllPermissionCaches,
} from '@/lib/rbac/cache';

let cache: MemoryCacheAdapter;

beforeEach(() => {
  cache = new MemoryCacheAdapter();
  setCache(cache);
});

describe('permissions/cache', () => {
  // Keys are tenant-scoped: user IDs are global while memberships and roles are per tenant, so a
  // user-only key would let one tenant's permissions be reused while authorizing in another.
  it('buildUserRolesCacheKey uses perm:roles:<tenant>: prefix', () => {
    expect(buildUserRolesCacheKey('u1')).toBe('perm:roles:default:u1');
  });

  it('buildUserFeaturesCacheKey uses perm:features:<tenant>: prefix', () => {
    expect(buildUserFeaturesCacheKey('u1')).toBe('perm:features:default:u1');
  });

  it('invalidateUserRolesCache deletes both roles and features keys for the user', async () => {
    await cache.set(buildUserRolesCacheKey('u1'), ['admin']);
    await cache.set(buildUserFeaturesCacheKey('u1'), ['sites']);
    await invalidateUserRolesCache('u1');
    expect(await cache.get(buildUserRolesCacheKey('u1'))).toBeNull();
    expect(await cache.get(buildUserFeaturesCacheKey('u1'))).toBeNull();
  });

  it('invalidateAllPermissionCaches clears all roles and features keys', async () => {
    await cache.set('perm:roles:u1', ['a']);
    await cache.set('perm:roles:u2', ['a']);
    await cache.set('perm:features:u3', ['x']);
    await cache.set('unrelated:key', 1);
    await invalidateAllPermissionCaches();
    expect(await cache.get('perm:roles:u1')).toBeNull();
    expect(await cache.get('perm:roles:u2')).toBeNull();
    expect(await cache.get('perm:features:u3')).toBeNull();
    expect(await cache.get('unrelated:key')).toBe(1);
  });
});
