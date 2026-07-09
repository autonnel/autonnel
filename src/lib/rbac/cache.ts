import { getCache } from '@/lib/adapters/cache';

const PERMISSION_CACHE_PREFIX = 'perm:roles:';
const PERMISSION_FEATURES_PREFIX = 'perm:features:';

export function buildUserRolesCacheKey(userId: string): string {
  return `${PERMISSION_CACHE_PREFIX}${userId}`;
}

export function buildUserFeaturesCacheKey(userId: string): string {
  return `${PERMISSION_FEATURES_PREFIX}${userId}`;
}

export async function invalidateUserRolesCache(userId: string): Promise<void> {
  const cache = getCache();
  await Promise.all([
    cache.delete(buildUserRolesCacheKey(userId)),
    cache.delete(buildUserFeaturesCacheKey(userId)),
  ]);
}

export async function invalidateAllPermissionCaches(): Promise<void> {
  const cache = getCache();
  await Promise.all([
    cache.deletePattern(`${PERMISSION_CACHE_PREFIX}*`),
    cache.deletePattern(`${PERMISSION_FEATURES_PREFIX}*`),
  ]);
}
