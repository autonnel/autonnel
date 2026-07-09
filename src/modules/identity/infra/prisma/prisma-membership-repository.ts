import { TenantMembership, MembershipStatus } from '../../domain/tenant-membership';
import type { MembershipRepositoryPort } from '../../application/ports/outbound';

interface MembershipRow {
  id: string; userId: string; roleIds: string[]; status: string;
}

// Constructed against the tenant-extended Prisma client which auto-injects tenantId on
// every where/create. Explicit tenantId params satisfy the port contract; the extension dedupes.
export class PrismaMembershipRepository implements MembershipRepositoryPort {
  constructor(private readonly db: { membership: { findFirst: Function; findMany: Function; count: Function; upsert: Function } }) {}

  async findByUserAndTenant(userId: string, _tenantId: string): Promise<TenantMembership | null> {
    const row = (await this.db.membership.findFirst({ where: { userId } })) as MembershipRow | null;
    return row ? toMembershipAggregate(row) : null;
  }

  async listByUser(userId: string): Promise<TenantMembership[]> {
    const rows = (await this.db.membership.findMany({ where: { userId } })) as MembershipRow[];
    return rows.map(toMembershipAggregate);
  }

  async listByTenant(): Promise<TenantMembership[]> {
    const rows = (await this.db.membership.findMany({})) as MembershipRow[];
    return rows.map(toMembershipAggregate);
  }

  async countActiveOwners(_tenantId: string): Promise<number> {
    return this.db.membership.count({ where: { status: MembershipStatus.Active } });
  }

  async save(membership: TenantMembership): Promise<void> {
    await this.db.membership.upsert({
      where: { id: membership.id },
      create: { id: membership.id, userId: membership.userId, roleIds: [...membership.roleIds], status: membership.status },
      update: { roleIds: [...membership.roleIds], status: membership.status },
    });
  }
}

function toMembershipAggregate(row: MembershipRow): TenantMembership {
  return TenantMembership.rehydrate({
    id: row.id, userId: row.userId, roleIds: row.roleIds,
    status: row.status === 'suspended' ? MembershipStatus.Suspended : MembershipStatus.Active,
  });
}
