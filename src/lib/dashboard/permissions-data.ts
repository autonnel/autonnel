
import { getPermissionRepository, virtualAdminRole } from '@/lib/rbac/repository';
import { VIRTUAL_ADMIN_ROLE_ID, VIRTUAL_ADMIN_ROLE_NAME } from '@/lib/rbac/config';
import type { RoleSummary } from './permissions-helpers';

function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch(() => fallback);
}

export interface PermissionsPageData {
  roles: RoleSummary[];
  users: Array<{
    id: string;
    email: string | null;
    name: string | null;
    avatar: string | null;
    roles: Array<{ id: string; name: string }>;
  }>;
}

export async function loadPermissionsPageData(): Promise<PermissionsPageData> {
  const repo = getPermissionRepository();

  const [users, roles] = await Promise.all([
    safe(repo.listAllUsersWithRoles(), [] as PermissionsPageData['users']),
    safe(repo.listRoles(), []),
  ]);

  const userRoleCounts = new Map<string, number>();
  for (const u of users) {
    for (const r of u.roles) {
      userRoleCounts.set(r.id, (userRoleCounts.get(r.id) ?? 0) + 1);
    }
  }

  const admin = virtualAdminRole();
  const adminSummary: RoleSummary = {
    id: admin.id,
    name: admin.name,
    description: admin.description,
    isSystem: true,
    features: admin.features,
    userCount: userRoleCounts.get(VIRTUAL_ADMIN_ROLE_ID) ?? 0,
  };

  // The real DB 'Admin' system role is surfaced as the virtual built-in admin above;
  // hide the duplicate DB row from the editable list.
  const customRoles: RoleSummary[] = await Promise.all(
    roles
      .filter((r) => r.name !== VIRTUAL_ADMIN_ROLE_NAME)
      .map(async (r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      features: await safe(repo.listRoleFeatures(r.id), [] as string[]),
      userCount: userRoleCounts.get(r.id) ?? 0,
    })),
  );

  return {
    users,
    roles: [adminSummary, ...customRoles],
  };
}
