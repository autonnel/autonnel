import { getCache } from '@/lib/adapters/cache';
import { getCurrentTenantId } from '@/lib/tenant/context';

const PERMISSION_CACHE_PREFIX = 'perm:roles:';
const PERMISSION_FEATURES_PREFIX = 'perm:features:';

// Longer than the shared CACHE_TTL.SHORT this used to borrow. Every mutation
// path in rbac/repository.ts calls invalidateUserRolesCache, so a role change
// takes effect on the next request regardless of TTL — the TTL is not the
// revocation mechanism here, it only bounds how often an unchanged entry is
// re-read from the DB and re-written to KV. Do NOT copy this to caches whose
// only invalidation is expiry (see lib/auth/apiAuth.ts).
export const PERMISSION_CACHE_TTL = 15 * 60;

// User IDs are global while memberships and roles are tenant-scoped, so the tenant MUST be part
// of the key — otherwise a request in a higher-privilege tenant seeds permissions that a later
// request in a lower-privilege tenant would accept until the TTL expires.
export function buildUserRolesCacheKey(userId: string): string {
  return `${PERMISSION_CACHE_PREFIX}${getCurrentTenantId()}:${userId}`;
}

export function buildUserFeaturesCacheKey(userId: string): string {
  return `${PERMISSION_FEATURES_PREFIX}${getCurrentTenantId()}:${userId}`;
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
