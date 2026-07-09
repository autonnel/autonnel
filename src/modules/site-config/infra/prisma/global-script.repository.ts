// tenantId is auto-injected by the Prisma extension on every write/where.
import { GlobalScript, type ScriptPosition } from '../../domain/global-script';
import type { GlobalScriptRepository } from '../../application/ports';

type Client = ReturnType<typeof import('../../../platform/infra/prisma-tenant-extension').getTenantPrisma>;

type Row = {
  id: string;
  tenantId: string;
  name: string;
  content: string;
  position: ScriptPosition;
  enabled: boolean;
  order: number;
};

function toDomain(row: Row): GlobalScript {
  return GlobalScript.rehydrate({
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    content: row.content,
    position: row.position,
    enabled: row.enabled,
    order: row.order,
  });
}

export class PrismaGlobalScriptRepository implements GlobalScriptRepository {
  constructor(private readonly db: Client) {}

  async list(): Promise<GlobalScript[]> {
    const rows = await this.db.globalScript.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
    return rows.map((r: Row) => toDomain(r));
  }

  async findById(id: string): Promise<GlobalScript | null> {
    const row = await this.db.globalScript.findFirst({ where: { id } });
    return row ? toDomain(row as Row) : null;
  }

  async create(script: GlobalScript): Promise<GlobalScript> {
    const row = await this.db.globalScript.create({
      data: {
        name: script.name,
        content: script.content,
        position: script.position,
        enabled: script.enabled,
        order: script.order,
      } as never,
    });
    return toDomain(row as Row);
  }

  async update(script: GlobalScript): Promise<GlobalScript> {
    const row = await this.db.globalScript.update({
      where: { id: script.id },
      data: {
        name: script.name,
        content: script.content,
        position: script.position,
        enabled: script.enabled,
        order: script.order,
      } as never,
    });
    return toDomain(row as Row);
  }

  async delete(id: string): Promise<void> {
    await this.db.globalScript.delete({ where: { id } });
  }
}
