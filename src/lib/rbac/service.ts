import { getCache, CACHE_TTL } from '@/lib/adapters/cache';
import { getPermissionRepository } from './repository';
import {
  getPermissionAdminIds,
  getPermissionAdminIdsAsync,
  FEATURES,
  VIRTUAL_ADMIN_ROLE_NAME,
  type FeatureId,
} from './config';
import {
  buildUserRolesCacheKey,
  buildUserFeaturesCacheKey,
  invalidateUserRolesCache,
  invalidateAllPermissionCaches,
} from './cache';

export { invalidateUserRolesCache, invalidateAllPermissionCaches };

const ALL_FEATURES: FeatureId[] = Object.values(FEATURES) as FeatureId[];

export async function getUserRoles(userId: string): Promise<string[]> {
  const cache = getCache();
  const cacheKey = buildUserRolesCacheKey(userId);

  const cached = await cache.get<string[]>(cacheKey);
  if (cached !== null) return cached;

  const repo = getPermissionRepository();
  // isAdmin shortcuts the entire role/feature lookup; required for built-in admin.
  if (await repo.isUserAdmin(userId)) {
    const roles = [VIRTUAL_ADMIN_ROLE_NAME];
    await cache.set(cacheKey, roles, CACHE_TTL.SHORT);
    return roles;
  }

  const roles = await repo.getUserRoleNames(userId);
  await cache.set(cacheKey, roles, CACHE_TTL.SHORT);

  return roles;
}

async function loadFeaturesForRoleNames(roleNames: string[]): Promise<Set<FeatureId>> {
  const repo = getPermissionRepository();
  const featureSet = new Set<FeatureId>();

  for (const name of roleNames) {
    const role = await repo.getRoleByName(name);
    if (!role) continue;
    const features = await repo.listRoleFeatures(role.id);
    for (const f of features) featureSet.add(f);
  }
  return featureSet;
}

export async function getUserFeatures(userId: string): Promise<FeatureId[]> {
  const cache = getCache();
  const cacheKey = buildUserFeaturesCacheKey(userId);

  const cached = await cache.get<FeatureId[]>(cacheKey);
  if (cached !== null) return cached;

  const repo = getPermissionRepository();
  if (await repo.isUserAdmin(userId)) {
    await cache.set(cacheKey, ALL_FEATURES, CACHE_TTL.SHORT);
    return ALL_FEATURES;
  }

  const dbRoles = await repo.getUserRoleNames(userId);
  const featureSet = await loadFeaturesForRoleNames(dbRoles);
  const features = Array.from(featureSet);

  await cache.set(cacheKey, features, CACHE_TTL.SHORT);
  return features;
}

export async function userHasFeature(
  userId: string,
  feature: FeatureId
): Promise<boolean> {
  const features = await getUserFeatures(userId);
  return features.includes(feature);
}

// Sync env-only; use canAccessPermissionsPageAsync whenever possible.
export function canAccessPermissionsPage(userId: string, providerId?: string): boolean {
  const allowedIds = getPermissionAdminIds();
  if (allowedIds.includes(userId)) return true;
  if (providerId && allowedIds.includes(providerId)) return true;
  return false;
}

export async function canAccessPermissionsPageAsync(
  userId: string,
  providerId?: string
): Promise<boolean> {
  if (await userHasFeature(userId, FEATURES.PERMISSIONS)) return true;
  const allowedIds = await getPermissionAdminIdsAsync();
  if (allowedIds.includes(userId)) return true;
  if (providerId && allowedIds.includes(providerId)) return true;
  return false;
}

export function deriveAccessibleNavIds(
  features: FeatureId[],
  userId: string,
  providerId?: string
): string[] {
  const featureSet = new Set(features);

  const NAV_ORDER: { id: string; features: FeatureId[] }[] = [
    { id: 'pages', features: [FEATURES.PAGES] },
    { id: 'funnels', features: [FEATURES.FUNNELS] },
    { id: 'marketing', features: [FEATURES.MARKETING] },
    { id: 'payment', features: [FEATURES.PAYMENT, FEATURES.PAYMENT_REFUND] },
    { id: 'orders', features: [FEATURES.ORDERS] },
    { id: 'analytics', features: [FEATURES.ANALYTICS] },
    { id: 'settings', features: [FEATURES.SETTINGS, FEATURES.SETTINGS_RECALL, FEATURES.SETTINGS_COUPON] },
  ];

  const navIds: string[] = [];
  for (const nav of NAV_ORDER) {
    if (nav.features.some((f) => featureSet.has(f))) {
      navIds.push(nav.id);
    }
  }

  if (featureSet.has(FEATURES.PERMISSIONS) || canAccessPermissionsPage(userId, providerId)) {
    navIds.push('permissions');
  }

  return navIds;
}

export async function getAccessibleNavIds(userId: string, providerId?: string): Promise<string[]> {
  const features = await getUserFeatures(userId);
  return deriveAccessibleNavIds(features, userId, providerId);
}

export async function getNavMenuForUser(userId: string, providerId?: string): Promise<string[]> {
  return getAccessibleNavIds(userId, providerId);
}
