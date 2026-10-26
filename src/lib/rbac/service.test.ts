import { describe, it, expect, vi, beforeEach } from 'vitest';

// Bypass caching entirely so each call re-runs the loader against the fake repository.
vi.mock('@/lib/adapters/cache', () => ({
  cacheGetOrSet: async (_key: string, _ttl: number, loader: () => Promise<unknown>) => loader(),
  withJitter: (ttl: number) => ttl,
}));

vi.mock('./cache', () => ({
  buildUserRolesCacheKey: (userId: string) => `roles:${userId}`,
  buildUserFeaturesCacheKey: (userId: string) => `features:${userId}`,
  invalidateUserRolesCache: vi.fn(),
  invalidateAllPermissionCaches: vi.fn(),
  PERMISSION_CACHE_TTL: 900,
}));

const roleFeatures = new Map<string, string[]>();

vi.mock('./repository', () => ({
  getPermissionRepository: () => ({
    isUserAdmin: async () => false,
    getUserRoleNames: async () => ['CustomRole'],
    getRoleByName: async (name: string) => (name === 'CustomRole' ? { id: 'role-1' } : null),
    listRoleFeatures: async (roleId: string) => roleFeatures.get(roleId) ?? [],
  }),
}));

import { getUserFeatures, userHasFeature } from './service';
import { FEATURES } from './config';

describe('rbac service feature-key normalization', () => {
  beforeEach(() => {
    roleFeatures.clear();
  });

  // PUT /api/permissions/roles/:id/features (the only real write path, backed by the identity
  // module's RolePolicy.setFeatureGrants) validates and stores grants in UPPER_SNAKE format, e.g.
  // "SETTINGS_ADS" -- never in this catalog's lower.dotted "settings.ads" format. A role granted
  // features the way the real admin UI actually grants them must still satisfy this catalog's gate.
  it('recognizes a grant stored in the real permissions API UPPER_SNAKE format', async () => {
    roleFeatures.set('role-1', ['SETTINGS_ADS', 'ANALYTICS']);

    const features = await getUserFeatures('user-1');
    expect(features).toContain(FEATURES.SETTINGS_ADS);
    expect(features).toContain(FEATURES.ANALYTICS);

    await expect(userHasFeature('user-1', FEATURES.SETTINGS_ADS)).resolves.toBe(true);
    await expect(userHasFeature('user-1', FEATURES.ANALYTICS)).resolves.toBe(true);
  });

  it('still recognizes a grant already stored in this catalog own lower.dotted format', async () => {
    roleFeatures.set('role-1', ['settings.ads']);

    await expect(userHasFeature('user-1', FEATURES.SETTINGS_ADS)).resolves.toBe(true);
  });

  it('ignores grants that match no known feature in either format', async () => {
    roleFeatures.set('role-1', ['NOT_A_REAL_FEATURE']);

    const features = await getUserFeatures('user-1');
    expect(features).toEqual([]);
  });
});
