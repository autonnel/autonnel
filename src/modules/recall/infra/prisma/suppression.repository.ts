import type { PrismaClient } from '@prisma/client';
import { SuppressionEntry } from '../../domain/suppression';
import type { SuppressionRepository } from '../../application/ports';
import type { SuppressionScopeValue } from '../../domain/value-objects';

type Row = {
  id: string; scope: string; subjectKey: string; reason: string; source: string; createdAt: Date; expiresAt: Date | null;
};

function toDomain(row: Row): SuppressionEntry {
  const e = SuppressionEntry.create(
    { scope: row.scope as any, subjectKey: row.subjectKey, reason: row.reason as any, source: row.source as any, expiresAt: row.expiresAt },
    row.createdAt,
  );
  (e as { id: string | null }).id = row.id;
  return e;
}

export class PrismaSuppressionRepository implements SuppressionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveBySubject(subjectKeys: string[], now: Date): Promise<SuppressionEntry[]> {
    const rows = await (this.prisma as any).recallSuppression.findMany({
      where: {
        subjectKey: { in: subjectKeys },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    return (rows as Row[]).map(toDomain);
  }

  async upsert(entry: SuppressionEntry): Promise<SuppressionEntry> {
    const row = await (this.prisma as any).recallSuppression.upsert({
      where: { tenantId_scope_subjectKey: { scope: entry.scope, subjectKey: entry.subjectKey } } as any,
      create: { scope: entry.scope, subjectKey: entry.subjectKey, reason: entry.reason, source: entry.source, expiresAt: entry.expiresAt },
      update: { reason: entry.reason, source: entry.source, expiresAt: entry.expiresAt },
    });
    return toDomain(row as Row);
  }

  async list(): Promise<SuppressionEntry[]> {
    const rows = await (this.prisma as any).recallSuppression.findMany({ orderBy: { createdAt: 'desc' } });
    return (rows as Row[]).map(toDomain);
  }

  async remove(scope: SuppressionScopeValue, subjectKey: string): Promise<void> {
    await (this.prisma as any).recallSuppression.deleteMany({ where: { scope, subjectKey } });
  }
}
