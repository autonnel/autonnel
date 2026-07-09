// node:async_hooks is provided on workerd (nodejs_compat).
// getCurrentTenantId() falls back to DEFAULT_TENANT so OSS single-tenant code never threads tenantId;
// tryGetTenantId() returns undefined when no context is established (used by the Prisma extension to
// skip injection for pre-ALS webhook lookups / UserAccount bypass).
import { AsyncLocalStorage } from "node:async_hooks";
import { DEFAULT_TENANT } from "../../modules/shared-kernel";
import type { Principal } from "../../modules/shared-kernel/principal";

interface TenantStore {
  tenantId: string;
  principal?: Principal | null;
}

// Pin the store to globalThis: Vite's dev HMR re-evaluates this module on edits, and a fresh
// AsyncLocalStorage would let middleware write the principal into one instance while page code
// reads another (null) — silently logging the admin out after every save. No-op in prod/Workers.
type GlobalWithStore = typeof globalThis & { __autonnelTenantAls?: AsyncLocalStorage<TenantStore> };
const als = ((globalThis as GlobalWithStore).__autonnelTenantAls ??= new AsyncLocalStorage<TenantStore>());

export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return als.run({ tenantId }, fn);
}

export function runWithContext<T>(
  store: { tenantId: string; principal?: Principal | null },
  fn: () => T,
): T {
  return als.run({ tenantId: store.tenantId, principal: store.principal ?? null }, fn);
}

export function getCurrentTenantId(): string {
  return als.getStore()?.tenantId ?? DEFAULT_TENANT;
}

export function tryGetTenantId(): string | undefined {
  return als.getStore()?.tenantId;
}

export function getCurrentPrincipal(): Principal | null {
  return als.getStore()?.principal ?? null;
}
