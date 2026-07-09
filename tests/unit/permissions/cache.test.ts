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
  it('buildUserRolesCacheKey uses perm:roles: prefix', () => {
    expect(buildUserRolesCacheKey('u1')).toBe('perm:roles:u1');
  });

  it('buildUserFeaturesCacheKey uses perm:features: prefix', () => {
    expect(buildUserFeaturesCacheKey('u1')).toBe('perm:features:u1');
  });

  it('invalidateUserRolesCache deletes both roles and features keys for the user', async () => {
    await cache.set('perm:roles:u1', ['admin']);
    await cache.set('perm:features:u1', ['sites']);
    await invalidateUserRolesCache('u1');
    expect(await cache.get('perm:roles:u1')).toBeNull();
    expect(await cache.get('perm:features:u1')).toBeNull();
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
