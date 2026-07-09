import { getCurrentTenantId } from '@/lib/tenant/context';

export function withTenantWhere<T>(where: T): T & { tenantId: string } {
  return { ...(where as object), tenantId: getCurrentTenantId() } as T & { tenantId: string };
}

export function withTenantData<T>(data: T): T & { tenantId: string } {
  return { ...(data as object), tenantId: getCurrentTenantId() } as T & { tenantId: string };
}

export function currentTenantId(): string {
  return getCurrentTenantId();
}
