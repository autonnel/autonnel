import { DEFAULT_TENANT } from '../../../shared-kernel/tenant-id';

export interface TenantResolutionInput {
  apiKeyTenantId: string | null;
  sessionActiveTenantId: string | null;
  hostTenantId: string | null;
}

// api-key tenant > session active tenant > host→tenant mapping > OSS Default Tenant. Pure: callers fetch the candidates; this only ranks them.
export class TenantContextResolver {
  resolve(input: TenantResolutionInput): string {
    return (
      input.apiKeyTenantId ??
      input.sessionActiveTenantId ??
      input.hostTenantId ??
      DEFAULT_TENANT
    );
  }
}
