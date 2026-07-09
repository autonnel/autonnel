// GLOBAL_SCOPE is the reserved ConfigEntry scope sentinel for tenant-agnostic config rows.
export const DEFAULT_TENANT = "default";
export const GLOBAL_SCOPE = "__global__";

export class TenantId {
  private constructor(readonly value: string) {}

  static of(value: string): TenantId {
    if (!value) throw new Error("TenantId must not be empty");
    return new TenantId(value);
  }

  static default(): TenantId {
    return new TenantId(DEFAULT_TENANT);
  }

  equals(other: TenantId): boolean {
    return this.value === other.value;
  }
}

export function toTenantId(value: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error("Invalid tenant id: must be a non-empty string");
  }
  return value;
}
