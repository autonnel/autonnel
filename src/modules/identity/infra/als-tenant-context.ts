// Wraps the single ALS store in src/lib/tenant/context.ts — the Prisma tenant extension reads from there; identity must not own a separate store.
import {
  runWithContext as runWithTenantStore,
  getCurrentTenantId as getStoreTenantId,
  getCurrentPrincipal as getStorePrincipal,
} from '../../../lib/tenant/context';
import type { Principal } from '../../shared-kernel/principal';

export interface IdentityContext {
  tenantId: string;
  principal: Principal | null;
}

export function runWithContext<T>(ctx: IdentityContext, fn: () => Promise<T>): Promise<T> {
  return runWithTenantStore({ tenantId: ctx.tenantId, principal: ctx.principal }, fn);
}

export function getCurrentContext(): IdentityContext {
  return { tenantId: getStoreTenantId(), principal: getStorePrincipal() };
}

export function getCurrentTenantId(): string {
  return getStoreTenantId();
}

export function getCurrentPrincipal(): Principal | null {
  return getStorePrincipal();
}
