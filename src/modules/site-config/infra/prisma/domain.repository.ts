// tenantId is auto-injected by the Prisma extension on every write/where.
import { Domain } from '../../domain/domain';
import type { DomainRepository } from '../../application/ports';

type Client = ReturnType<typeof import('../../../platform/infra/prisma-tenant-extension').getTenantPrisma>;

type Row = { id: string; tenantId: string; host: string; isPrimary: boolean };

function toDomain(row: Row): Domain {
  return Domain.rehydrate({ id: row.id, tenantId: row.tenantId, host: row.host, isPrimary: row.isPrimary });
}

export class PrismaDomainRepository implements DomainRepository {
  constructor(private readonly db: Client) {}

  async list(): Promise<Domain[]> {
    const rows = await this.db.domain.findMany({ orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] });
    return rows.map((r: Row) => toDomain(r));
  }

  async findById(id: string): Promise<Domain | null> {
    const row = await this.db.domain.findFirst({ where: { id } });
    return row ? toDomain(row as Row) : null;
  }

  async findByHost(host: string): Promise<Domain | null> {
    const row = await this.db.domain.findFirst({ where: { host } });
    return row ? toDomain(row as Row) : null;
  }

  async create(domain: Domain): Promise<Domain> {
    const row = await this.db.domain.create({
      data: { host: domain.host, isPrimary: domain.isPrimary } as never,
    });
    return toDomain(row as Row);
  }

  async setPrimary(id: string): Promise<Domain> {
    await this.db.domain.updateMany({ where: { isPrimary: true }, data: { isPrimary: false } as never });
    const row = await this.db.domain.update({ where: { id }, data: { isPrimary: true } as never });
    return toDomain(row as Row);
  }

  async delete(id: string): Promise<void> {
    await this.db.domain.delete({ where: { id } });
  }
}
