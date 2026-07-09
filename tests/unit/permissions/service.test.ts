import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setCache } from '@/lib/adapters/cache';
import { MemoryCacheAdapter } from '@/lib/adapters/cache/memory';
import { setPermissionRepository } from '@/lib/rbac/repository';

const { env } = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('@/lib/runtime/env', () => ({
  readEnv: (k: string) => env[k],
  isCloudflareRuntime: () => false,
  getBinding: () => undefined,
}));

import {
  getUserRoles,
  getUserFeatures,
  userHasFeature,
  canAccessPermissionsPage,
  deriveAccessibleNavIds,
  getAccessibleNavIds,
  getNavMenuForUser,
} from '@/lib/rbac/service';
import { FEATURES } from '@/lib/rbac/config';

const fakeRepo = {
  isUserAdmin: vi.fn(),
  setUserIsAdmin: vi.fn(),
  getUserRoleNames: vi.fn(),
  getRoleByName: vi.fn(),
  listRoleFeatures: vi.fn(),
  // Unused stubs for the interface
  listRoles: vi.fn(),
  getRoleById: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  setRoleFeatures: vi.fn(),
  getUserRoles: vi.fn(),
  assignUserRole: vi.fn(),
  removeUserRole: vi.fn(),
  setUserRoles: vi.fn(),
  listAllUsersWithRoles: vi.fn(),
  listUsers: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  setCache(new MemoryCacheAdapter());
  setPermissionRepository(fakeRepo as any);
  fakeRepo.isUserAdmin.mockResolvedValue(false);
  for (const k of Object.keys(env)) delete env[k];
});

describe('permissions/service — role lookup', () => {
  it('getUserRoles caches results across calls', async () => {
    fakeRepo.getUserRoleNames.mockResolvedValue(['cs']);
    expect(await getUserRoles('u1')).toEqual(['cs']);
    expect(await getUserRoles('u1')).toEqual(['cs']);
    expect(fakeRepo.getUserRoleNames).toHaveBeenCalledTimes(1);
  });

  it('getUserRoles returns the virtual admin role when User.isAdmin', async () => {
    fakeRepo.isUserAdmin.mockResolvedValue(true);
    expect(await getUserRoles('u_admin')).toEqual(['Admin']);
    expect(fakeRepo.getUserRoleNames).not.toHaveBeenCalled();
  });

  it('getUserFeatures resolves features for all assigned roles', async () => {
    fakeRepo.getUserRoleNames.mockResolvedValue(['cs']);
    fakeRepo.getRoleByName.mockImplementation(async (n: string) => n === 'cs' ? { id: 'r1', name: 'cs' } : null);
    fakeRepo.listRoleFeatures.mockResolvedValue([FEATURES.PAGES, FEATURES.ORDERS]);
    const features = await getUserFeatures('u1');
    expect(features).toContain(FEATURES.PAGES);
    expect(features).toContain(FEATURES.ORDERS);
  });

  it('getUserFeatures returns ALL features when User.isAdmin', async () => {
    fakeRepo.isUserAdmin.mockResolvedValue(true);
    const features = await getUserFeatures('u_admin');
    for (const id of Object.values(FEATURES)) {
      expect(features).toContain(id);
    }
  });

  it('getUserFeatures returns empty when user has no roles and is not admin', async () => {
    fakeRepo.getUserRoleNames.mockResolvedValue([]);
    const features = await getUserFeatures('u_new');
    expect(features).toEqual([]);
  });

  it('userHasFeature is true when feature is present in user features', async () => {
    fakeRepo.getUserRoleNames.mockResolvedValue(['cs']);
    fakeRepo.getRoleByName.mockResolvedValue({ id: 'r1', name: 'cs' });
    fakeRepo.listRoleFeatures.mockResolvedValue([FEATURES.PAGES]);
    expect(await userHasFeature('u1', FEATURES.PAGES)).toBe(true);
    expect(await userHasFeature('u1', FEATURES.PERMISSIONS)).toBe(false);
  });
});

describe('permissions/service — admin access', () => {
  it('canAccessPermissionsPage matches against PERMISSIONS_ADMIN_USER_IDS env', () => {
    env.PERMISSIONS_ADMIN_USER_IDS = 'u_admin , u_provider';
    expect(canAccessPermissionsPage('u_admin')).toBe(true);
    expect(canAccessPermissionsPage('not_admin')).toBe(false);
    expect(canAccessPermissionsPage('not_admin', 'u_provider')).toBe(true);
  });

  it('canAccessPermissionsPage returns false when env var unset', () => {
    expect(canAccessPermissionsPage('u_x')).toBe(false);
  });
});

describe('permissions/service — navigation derivation', () => {
  it('deriveAccessibleNavIds returns nav ids for which any feature is present', () => {
    const nav = deriveAccessibleNavIds([FEATURES.PAGES, FEATURES.ORDERS], 'u');
    expect(nav).toContain('pages');
    expect(nav).toContain('orders');
    expect(nav).not.toContain('funnels');
  });

  it('deriveAccessibleNavIds appends "permissions" when user is an admin', () => {
    env.PERMISSIONS_ADMIN_USER_IDS = 'u_admin';
    const nav = deriveAccessibleNavIds([FEATURES.PAGES], 'u_admin');
    expect(nav).toContain('permissions');
  });

  it('getAccessibleNavIds and getNavMenuForUser delegate to deriveAccessibleNavIds', async () => {
    fakeRepo.getUserRoleNames.mockResolvedValue(['cs']);
    fakeRepo.getRoleByName.mockResolvedValue({ id: 'r1', name: 'cs' });
    fakeRepo.listRoleFeatures.mockResolvedValue([FEATURES.PAGES]);
    const a = await getAccessibleNavIds('u1');
    const b = await getNavMenuForUser('u1');
    expect(a).toEqual(b);
    expect(a).toContain('pages');
  });
});
