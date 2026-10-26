import { getCurrentTenantId } from '../../../../lib/tenant/context';
import type { AdCreativeRepositoryPort, CreativeRow, CreativeUpsert } from '../../application/ports/outbound';

interface CreativeDelegate {
  upsert(args: unknown): Promise<any>;
  findMany(args: unknown): Promise<any[]>;
  findFirst(args: unknown): Promise<any | null>;
  update(args: unknown): Promise<unknown>;
}

function toRow(r: any): CreativeRow {
  return {
    id: r.id,
    connectionId: r.connectionId,
    platform: r.platform,
    externalAdId: r.externalAdId,
    name: r.name,
    status: r.status,
    campaignExternalId: r.campaignExternalId ?? null,
    campaignName: r.campaignName ?? null,
    adsetExternalId: r.adsetExternalId ?? null,
    adsetName: r.adsetName ?? null,
    destinationUrl: r.destinationUrl ?? null,
    normalizedPath: r.normalizedPath ?? null,
    autoFunnelId: r.autoFunnelId ?? null,
    manualFunnelId: r.manualFunnelId ?? null,
    matchState: r.matchState,
    lastSeenAt: new Date(r.lastSeenAt),
  };
}

export class PrismaAdCreativeRepository implements AdCreativeRepositoryPort {
  constructor(
    private readonly delegate: CreativeDelegate,
    private readonly newId: () => string,
  ) {}

  async upsertMany(connectionId: string, platform: string, rows: CreativeUpsert[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    for (const row of rows) {
      // The tenant extension only injects tenantId into `create` on an upsert, not into `where`
      // (see prisma-tenant-extension.ts), so the composite key needs it here explicitly. It must
      // NOT also be spread into `create` below, or it would collide with the extension's own
      // injection there.
      // manualFunnelId is absent from `update` on purpose: an operator assignment must survive
      // every resync, including one where the destination URL changed.
      const saved = await this.delegate.upsert({
        where: {
          tenantId_connectionId_externalAdId: {
            tenantId: getCurrentTenantId(),
            connectionId,
            externalAdId: row.externalAdId,
          },
        },
        create: {
          id: this.newId(),
          connectionId,
          platform,
          manualFunnelId: null,
          ...row,
        },
        update: {
          name: row.name,
          status: row.status,
          campaignExternalId: row.campaignExternalId,
          campaignName: row.campaignName,
          adsetExternalId: row.adsetExternalId,
          adsetName: row.adsetName,
          destinationUrl: row.destinationUrl,
          normalizedPath: row.normalizedPath,
          autoFunnelId: row.autoFunnelId,
          matchState: row.matchState,
          lastSeenAt: row.lastSeenAt,
        },
      });
      out.set(row.externalAdId, saved.id);
    }
    return out;
  }

  async listByConnection(connectionId: string): Promise<CreativeRow[]> {
    const rows = await this.delegate.findMany({ where: { connectionId } });
    return rows.map(toRow);
  }

  async findById(creativeId: string): Promise<CreativeRow | null> {
    const row = await this.delegate.findFirst({ where: { id: creativeId } });
    return row ? toRow(row) : null;
  }

  async setManualFunnel(creativeId: string, funnelId: string | null): Promise<void> {
    await this.delegate.update({ where: { id: creativeId }, data: { manualFunnelId: funnelId } });
  }
}
