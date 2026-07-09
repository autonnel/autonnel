import { getBasePrisma } from '@/lib/db';
import { FEATURES, VIRTUAL_ADMIN_ROLE_ID, VIRTUAL_ADMIN_ROLE_NAME, type FeatureId } from './config';
import { invalidateAllPermissionCaches, invalidateUserRolesCache } from './cache';
import { getCurrentTenantId } from '@/lib/tenant/context';

export interface RoleRecord {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleWithFeatures extends RoleRecord {
  features: FeatureId[];
}

export interface UserWithRoles {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  roles: Array<{ id: string; name: string }>;
}

export interface IPermissionRepository {
  listRoles(): Promise<RoleRecord[]>;
  getRoleById(id: string): Promise<RoleRecord | null>;
  getRoleByName(name: string): Promise<RoleRecord | null>;
  createRole(input: { name: string; description?: string | null; isSystem?: boolean }): Promise<RoleRecord>;
  updateRole(id: string, data: { name?: string; description?: string | null }): Promise<RoleRecord>;
  deleteRole(id: string): Promise<void>;

  listRoleFeatures(roleId: string): Promise<FeatureId[]>;
  setRoleFeatures(roleId: string, featureIds: FeatureId[]): Promise<void>;

  isUserAdmin(userId: string): Promise<boolean>;
  setUserIsAdmin(userId: string, isAdmin: boolean): Promise<void>;
  getUserRoleNames(userId: string): Promise<string[]>;
  getUserRoles(userId: string): Promise<RoleRecord[]>;
  assignUserRole(userId: string, roleId: string): Promise<void>;
  removeUserRole(userId: string, roleId: string): Promise<void>;
  setUserRoles(userId: string, roleIds: string[]): Promise<void>;

  listAllUsersWithRoles(): Promise<UserWithRoles[]>;
  listUsers(): Promise<Array<{ id: string; email: string | null; name: string | null; avatar: string | null }>>;
}


export function virtualAdminRole(): RoleWithFeatures {
  const now = new Date(0);
  return {
    id: VIRTUAL_ADMIN_ROLE_ID,
    name: VIRTUAL_ADMIN_ROLE_NAME,
    description: 'Built-in: full access',
    isSystem: true,
    createdAt: now,
    updatedAt: now,
    features: Object.values(FEATURES) as FeatureId[],
  };
}

// isAdmin is modeled as a tenant-scoped system Role; there is no dedicated boolean column.
async function ensureAdminRoleId(tenantId: string): Promise<string> {
  const existing = await getBasePrisma().role.findUnique({
    where: { tenantId_name: { tenantId, name: VIRTUAL_ADMIN_ROLE_NAME } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await getBasePrisma().role.create({
    data: { tenantId, name: VIRTUAL_ADMIN_ROLE_NAME, description: 'Built-in: full access', isSystem: true },
    select: { id: true },
  });
  return created.id;
}

async function findAdminRoleId(tenantId: string): Promise<string | null> {
  const row = await getBasePrisma().role.findUnique({
    where: { tenantId_name: { tenantId, name: VIRTUAL_ADMIN_ROLE_NAME } },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function readMembershipRoleIds(tenantId: string, userId: string): Promise<string[]> {
  const m = await getBasePrisma().membership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { roleIds: true },
  });
  return m?.roleIds ?? [];
}

async function writeMembershipRoleIds(tenantId: string, userId: string, roleIds: string[]): Promise<void> {
  await getBasePrisma().membership.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    create: { tenantId, userId, roleIds, status: 'active' },
    update: { roleIds },
  });
}

export class PrismaPermissionRepository implements IPermissionRepository {
  async listRoles(): Promise<RoleRecord[]> {
    const tenantId = getCurrentTenantId();
    return getBasePrisma().role.findMany({
      where: { tenantId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async getRoleById(id: string): Promise<RoleRecord | null> {
    const tenantId = getCurrentTenantId();
    return getBasePrisma().role.findFirst({ where: { id, tenantId } });
  }

  async getRoleByName(name: string): Promise<RoleRecord | null> {
    const tenantId = getCurrentTenantId();
    return getBasePrisma().role.findUnique({ where: { tenantId_name: { tenantId, name } } });
  }

  async createRole(input: { name: string; description?: string | null; isSystem?: boolean }): Promise<RoleRecord> {
    const tenantId = getCurrentTenantId();
    const role = await getBasePrisma().role.create({
      data: {
        tenantId,
        name: input.name,
        description: input.description ?? null,
        isSystem: input.isSystem ?? false,
      },
    });
    await invalidateAllPermissionCaches();
    return role;
  }

  async updateRole(id: string, data: { name?: string; description?: string | null }): Promise<RoleRecord> {
    const tenantId = getCurrentTenantId();
    const existing = await getBasePrisma().role.findFirst({ where: { id, tenantId } });
    if (!existing) throw new Error(`Role ${id} not found`);
    if (existing.isSystem && data.name && data.name !== existing.name) {
      throw new Error('System role name cannot be changed');
    }
    const updateResult = await getBasePrisma().role.updateMany({
      where: { id, tenantId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    });
    if (updateResult.count === 0) throw new Error(`Role ${id} not found`);
    const role = await getBasePrisma().role.findFirst({ where: { id, tenantId } });
    await invalidateAllPermissionCaches();
    return role as RoleRecord;
  }

  async deleteRole(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    const existing = await getBasePrisma().role.findFirst({ where: { id, tenantId } });
    if (!existing) return;
    if (existing.isSystem) {
      throw new Error('System roles cannot be deleted');
    }
    await getBasePrisma().role.deleteMany({ where: { id, tenantId } });
    await invalidateAllPermissionCaches();
  }

  async listRoleFeatures(roleId: string): Promise<FeatureId[]> {
    const tenantId = getCurrentTenantId();
    const role = await getBasePrisma().role.findFirst({
      where: { id: roleId, tenantId },
      select: { grants: true },
    });
    return (role?.grants ?? []) as FeatureId[];
  }

  async setRoleFeatures(roleId: string, featureIds: FeatureId[]): Promise<void> {
    const tenantId = getCurrentTenantId();
    const unique = Array.from(new Set(featureIds));
    const result = await getBasePrisma().role.updateMany({
      where: { id: roleId, tenantId },
      data: { grants: unique },
    });
    if (result.count === 0) throw new Error(`Role ${roleId} not found`);
    await invalidateAllPermissionCaches();
  }

  async isUserAdmin(userId: string): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const adminRoleId = await findAdminRoleId(tenantId);
    if (!adminRoleId) return false;
    const roleIds = await readMembershipRoleIds(tenantId, userId);
    return roleIds.includes(adminRoleId);
  }

  async setUserIsAdmin(userId: string, isAdmin: boolean): Promise<void> {
    const tenantId = getCurrentTenantId();
    const roleIds = new Set(await readMembershipRoleIds(tenantId, userId));
    if (isAdmin) {
      roleIds.add(await ensureAdminRoleId(tenantId));
    } else {
      const adminRoleId = await findAdminRoleId(tenantId);
      if (adminRoleId) roleIds.delete(adminRoleId);
    }
    await writeMembershipRoleIds(tenantId, userId, [...roleIds]);
    await invalidateUserRolesCache(userId);
  }

  async getUserRoleNames(userId: string): Promise<string[]> {
    if (await this.isUserAdmin(userId)) return [VIRTUAL_ADMIN_ROLE_NAME];
    const roles = await this.getUserRoles(userId);
    return roles.map((r) => r.name);
  }

  async getUserRoles(userId: string): Promise<RoleRecord[]> {
    const tenantId = getCurrentTenantId();
    const adminRoleId = await findAdminRoleId(tenantId);
    const roleIds = await readMembershipRoleIds(tenantId, userId);
    const isAdmin = adminRoleId !== null && roleIds.includes(adminRoleId);
    const adminFirst = isAdmin ? [toRoleRecord(virtualAdminRole())] : [];
    const otherIds = roleIds.filter((id) => id !== adminRoleId);
    if (otherIds.length === 0) return adminFirst;
    const roles = await getBasePrisma().role.findMany({
      where: { id: { in: otherIds }, tenantId },
    });
    return [...adminFirst, ...roles.filter((r) => r.name !== VIRTUAL_ADMIN_ROLE_NAME)];
  }

  async assignUserRole(userId: string, roleId: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    const role = await getBasePrisma().role.findFirst({ where: { id: roleId, tenantId }, select: { id: true } });
    if (!role) throw new Error(`Role ${roleId} not found`);
    const roleIds = new Set(await readMembershipRoleIds(tenantId, userId));
    roleIds.add(roleId);
    await writeMembershipRoleIds(tenantId, userId, [...roleIds]);
    await invalidateUserRolesCache(userId);
  }

  async removeUserRole(userId: string, roleId: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    const roleIds = (await readMembershipRoleIds(tenantId, userId)).filter((id) => id !== roleId);
    await writeMembershipRoleIds(tenantId, userId, roleIds);
    await invalidateUserRolesCache(userId);
  }

  async setUserRoles(userId: string, roleIds: string[]): Promise<void> {
    const tenantId = getCurrentTenantId();
    const unique = Array.from(new Set(roleIds));
    const wantsAdmin = unique.includes(VIRTUAL_ADMIN_ROLE_ID);
    const customRoleIds = unique.filter((id) => id !== VIRTUAL_ADMIN_ROLE_ID);

    if (customRoleIds.length > 0) {
      const foundRoles = await getBasePrisma().role.findMany({
        where: { id: { in: customRoleIds }, tenantId },
        select: { id: true },
      });
      if (foundRoles.length !== customRoleIds.length) {
        throw new Error('One or more role IDs do not belong to this tenant');
      }
    }

    const finalIds = [...customRoleIds];
    if (wantsAdmin) finalIds.push(await ensureAdminRoleId(tenantId));
    await writeMembershipRoleIds(tenantId, userId, Array.from(new Set(finalIds)));
    await invalidateUserRolesCache(userId);
  }

  async listAllUsersWithRoles(): Promise<UserWithRoles[]> {
    const tenantId = getCurrentTenantId();
    const memberships = await getBasePrisma().membership.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { userId: true, roleIds: true },
    });
    const userIds = memberships.map((m) => m.userId);
    if (userIds.length === 0) return [];

    const [users, roles] = await Promise.all([
      getBasePrisma().user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true },
      }),
      getBasePrisma().role.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    ]);

    const roleNameById = new Map(roles.map((r) => [r.id, r.name] as const));
    const adminRoleId = roles.find((r) => r.name === VIRTUAL_ADMIN_ROLE_NAME)?.id ?? null;
    const linksByUser = new Map<string, string[]>(memberships.map((m) => [m.userId, m.roleIds] as const));
    const emailById = new Map(users.map((u) => [u.id, u.email] as const));

    return userIds.map((id) => {
      const roleIds = linksByUser.get(id) ?? [];
      const isAdmin = adminRoleId !== null && roleIds.includes(adminRoleId);
      const adminFirst = isAdmin ? [{ id: VIRTUAL_ADMIN_ROLE_ID, name: VIRTUAL_ADMIN_ROLE_NAME }] : [];
      const custom = roleIds
        .filter((rid) => rid !== adminRoleId && roleNameById.has(rid))
        .map((rid) => ({ id: rid, name: roleNameById.get(rid)! }));
      return {
        id,
        email: emailById.get(id) ?? null,
        name: null,
        avatar: null,
        roles: [...adminFirst, ...custom],
      };
    });
  }

  async listUsers(): Promise<Array<{ id: string; email: string | null; name: string | null; avatar: string | null }>> {
    const tenantId = getCurrentTenantId();
    const memberships = await getBasePrisma().membership.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });
    const userIds = memberships.map((m) => m.userId);
    if (userIds.length === 0) return [];
    const users = await getBasePrisma().user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u.email] as const));
    return userIds
      .filter((id) => byId.has(id))
      .map((id) => ({ id, email: byId.get(id) ?? null, name: null, avatar: null }));
  }
}

function toRoleRecord(r: RoleWithFeatures): RoleRecord {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

let instance: IPermissionRepository = new PrismaPermissionRepository();

export function getPermissionRepository(): IPermissionRepository {
  return instance;
}

export function setPermissionRepository(repo: IPermissionRepository): void {
  instance = repo;
}
