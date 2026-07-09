import type { ConfigRepositoryPort } from "../../application/ports";

export class PrismaConfigRepository implements ConfigRepositoryPort {
  constructor(private readonly db: any) {}

  async get(tenantId: string, configKey: string) {
    const row = await this.db.configEntry.findUnique({ where: { tenantId_configKey: { tenantId, configKey } } });
    return row ? { value: row.value, isSecret: row.isSecret } : null;
  }

  async set(row: { tenantId: string; configKey: string; value: unknown; isSecret: boolean; ownerNamespace: string | null }) {
    await this.db.configEntry.upsert({
      where: { tenantId_configKey: { tenantId: row.tenantId, configKey: row.configKey } },
      create: { ...row, value: row.value as object },
      update: { value: row.value as object, isSecret: row.isSecret, ownerNamespace: row.ownerNamespace },
    });
  }
}
