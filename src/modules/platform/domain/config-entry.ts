// Secret values are stored as a SecretRef indirection so they never serialize into
// errors/logs/events.
import { GLOBAL_SCOPE } from "../../shared-kernel";

const KEY_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

export class SecretRef {
  constructor(readonly ref: string) {}
}

export type ConfigValue = string | number | boolean | object | SecretRef;

export class ConfigEntry {
  private constructor(
    readonly tenantId: string,
    readonly configKey: string,
    readonly value: ConfigValue,
    readonly isSecret: boolean,
    readonly ownerNamespace: string | null,
  ) {}

  static create(args: {
    tenantId: string;
    configKey: string;
    value: ConfigValue;
    isSecret?: boolean;
    ownerNamespace?: string | null;
  }): ConfigEntry {
    if (!KEY_PATTERN.test(args.configKey)) {
      throw new Error(`ConfigKey must be a well-formed dotted/namespaced key: "${args.configKey}"`);
    }
    return new ConfigEntry(
      args.tenantId,
      args.configKey,
      args.value,
      args.isSecret ?? args.value instanceof SecretRef,
      args.ownerNamespace ?? null,
    );
  }

  isGlobal(): boolean {
    return this.tenantId === GLOBAL_SCOPE;
  }
}
