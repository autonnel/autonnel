import { FunnelScript, type ScriptPosition } from '../../domain/funnel-script';
import type { FunnelScriptRepository } from '../../application/ports';

type Client = ReturnType<typeof import('../../../platform/infra/prisma-tenant-extension').getTenantPrisma>;

interface Row {
  id: string;
  funnelId: string;
  name: string;
  content: string;
  position: ScriptPosition;
  isActive: boolean;
  order: number;
}

function toDomain(row: Row): FunnelScript {
  return FunnelScript.rehydrate({
    id: row.id,
    funnelId: row.funnelId,
    name: row.name,
    content: row.content,
    position: row.position,
    isActive: row.isActive,
    order: row.order,
  });
}

export class PrismaFunnelScriptRepository implements FunnelScriptRepository {
  constructor(private readonly db: Client) {}

  async listByFunnel(funnelId: string): Promise<FunnelScript[]> {
    const rows = await this.db.funnelScript.findMany({ where: { funnelId }, orderBy: { order: 'asc' } });
    return rows.map((r) => toDomain(r as Row));
  }

  async findById(id: string): Promise<FunnelScript | null> {
    const row = await this.db.funnelScript.findFirst({ where: { id } });
    return row ? toDomain(row as Row) : null;
  }

  async create(script: FunnelScript): Promise<FunnelScript> {
    const row = await this.db.funnelScript.create({
      data: {
        funnelId: script.funnelId,
        name: script.name,
        content: script.content,
        position: script.position,
        isActive: script.isActive,
        order: script.order,
      } as never,
    });
    return toDomain(row as Row);
  }

  async update(script: FunnelScript): Promise<FunnelScript> {
    const row = await this.db.funnelScript.update({
      where: { id: script.id },
      data: {
        name: script.name,
        content: script.content,
        position: script.position,
        isActive: script.isActive,
        order: script.order,
      } as never,
    });
    return toDomain(row as Row);
  }

  async delete(id: string): Promise<void> {
    await this.db.funnelScript.delete({ where: { id } });
  }
}
