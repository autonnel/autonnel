import { RolePolicy } from '../../domain/role-policy';
import { isFeatureKey, toFeatureKey, type FeatureKey } from '../../domain/feature-key';
import type { RoleRepositoryPort, FeatureCatalogPort } from '../../application/ports/outbound';

interface RoleRow {
  id: string; name: string; description: string | null; isSystem: boolean; grants: string[];
}

// The built-in full-access role. Its effective grants are the entire feature catalog, computed at
// read time (mirroring rbac's virtualAdminRole) rather than read from the stored grants[] column —
// so a newly-added feature is authorized for admins on the next request with no migration/back-fill.
const FULL_ACCESS_ROLE_NAME = 'Admin';

export class PrismaRoleRepository implements RoleRepositoryPort {
  constructor(
    private readonly db: { role: { findMany: Function; findFirst: Function; upsert: Function; delete: Function } },
    private readonly catalog?: FeatureCatalogPort,
  ) {}

  async listByTenant(): Promise<RolePolicy[]> {
    const rows = (await this.db.role.findMany({})) as RoleRow[];
    return rows.map((r) => toRoleAggregate(r, this.catalog));
  }

  async findById(roleId: string): Promise<RolePolicy | null> {
    const row = (await this.db.role.findFirst({ where: { id: roleId } })) as RoleRow | null;
    return row ? toRoleAggregate(row, this.catalog) : null;
  }

  async save(role: RolePolicy): Promise<void> {
    const grants = role.grants().map(String);
    await this.db.role.upsert({
      where: { id: role.id },
      create: { id: role.id, name: role.name, description: role.description, isSystem: role.isSystem, grants } as never,
      update: { name: role.name, description: role.description, grants } as never,
    });
  }

  async delete(roleId: string): Promise<void> {
    await this.db.role.delete({ where: { id: roleId } });
  }
}

function toRoleAggregate(row: RoleRow, catalog?: FeatureCatalogPort): RolePolicy {
  const grants =
    row.isSystem && row.name === FULL_ACCESS_ROLE_NAME && catalog
      ? [...catalog.allKeys()].filter(isFeatureKey).map(toFeatureKey)
      : (row.grants.filter(isFeatureKey) as FeatureKey[]);
  return RolePolicy.create({ id: row.id, name: row.name, description: row.description ?? null, isSystem: row.isSystem, grants });
}
