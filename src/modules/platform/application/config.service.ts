import { ConfigEntry, SecretRef } from "../domain/config-entry";
import { ConfigResolutionService } from "../domain/config-resolution";
import { GLOBAL_SCOPE } from "../../shared-kernel";
import type { ConfigRepositoryPort, EnvConfigPort, TenantContextPort } from "./ports";

export class GetEffectiveConfigService {
  private readonly resolution = new ConfigResolutionService();

  constructor(
    private readonly repo: ConfigRepositoryPort,
    private readonly env: EnvConfigPort,
    private readonly tenant: TenantContextPort,
  ) {}

  async get(configKey: string, opts: { secretReader?: boolean } = {}): Promise<unknown> {
    const tenantId = this.tenant.current();
    const tenantRow = await this.repo.get(tenantId, configKey);
    const globalRow = tenantId === GLOBAL_SCOPE ? null : await this.repo.get(GLOBAL_SCOPE, configKey);
    return this.resolution.resolve(
      { tenant: tenantRow?.value, global: globalRow?.value, env: this.env.read(configKey) },
      { secretReader: opts.secretReader },
    );
  }
}

export class SetConfigService {
  constructor(
    private readonly repo: ConfigRepositoryPort,
    private readonly tenant: TenantContextPort,
  ) {}

  async set(configKey: string, value: unknown, opts: { ownerNamespace?: string | null } = {}): Promise<void> {
    const entry = ConfigEntry.create({
      tenantId: this.tenant.current(),
      configKey,
      value: value as never,
      ownerNamespace: opts.ownerNamespace ?? null,
    });
    await this.repo.set({
      tenantId: entry.tenantId,
      configKey: entry.configKey,
      value: entry.value instanceof SecretRef ? { __secretRef: entry.value.ref } : entry.value,
      isSecret: entry.isSecret,
      ownerNamespace: entry.ownerNamespace,
    });
  }
}
