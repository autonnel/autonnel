import { SuppressionEntry } from '../../domain/suppression-entry';
import { Address, ChannelType, SuppressionReason } from '../../domain/value-objects';
import type { SuppressionRepositoryPort } from '../../application/ports/outbound';

type Client = ReturnType<typeof import('../../../platform/infra/prisma-tenant-extension').getTenantPrisma>;

function rehydrate(row: any): SuppressionEntry {
  return SuppressionEntry.rehydrate({
    id: row.id, tenantId: row.tenantId, channel: row.channel as ChannelType,
    normalizedAddress: row.normalizedAddress, reason: row.reason as SuppressionReason,
    source: row.source, active: row.active, unsuppressedBy: row.unsuppressedBy ?? undefined,
  });
}

// tenantId is auto-injected by the Prisma extension on every write/where.
export class PrismaSuppressionRepository implements SuppressionRepositoryPort {
  constructor(private readonly db: Client | any) {}

  async findForAddress(address: Address): Promise<SuppressionEntry[]> {
    const rows = await this.db.messageSuppression.findMany({ where: { channel: address.channel, normalizedAddress: address.normalized } });
    return rows.map(rehydrate);
  }

  async list(channel?: ChannelType): Promise<SuppressionEntry[]> {
    const rows = await this.db.messageSuppression.findMany({ where: channel ? { channel } : {}, orderBy: { createdAt: 'desc' } });
    return rows.map(rehydrate);
  }

  async upsert(entry: SuppressionEntry): Promise<SuppressionEntry> {
    const row = await this.db.messageSuppression.upsert({
      where: { tenantId_channel_normalizedAddress: { tenantId: entry.tenantId, channel: entry.channel, normalizedAddress: entry.normalizedAddress } },
      create: { channel: entry.channel, normalizedAddress: entry.normalizedAddress, reason: entry.reason, source: entry.source, active: entry.active, unsuppressedBy: entry.unsuppressedBy },
      update: { active: entry.active, unsuppressedBy: entry.unsuppressedBy, reason: entry.reason },
    });
    return rehydrate(row);
  }
}
