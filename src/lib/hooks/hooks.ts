import type { Order } from '@prisma/client';
import type { TenantContext, TenantResolver } from '@/lib/tenant/types';
import { setTenantResolver } from '@/lib/tenant/resolver';

export interface TenantConfig {
  id: string;
  metadata?: Record<string, unknown>;
}

export interface Hooks {
  onOrderCreated?: (ctx: TenantContext, order: Order) => Promise<void> | void;
  resolveTenant?: TenantResolver;
  getTenantConfig?: (tenantId: string) => Promise<TenantConfig | null>;
  getAllTenantIds?: () => Promise<string[]>;
}

let registered: Hooks = {};

export function registerHooks(partial: Partial<Hooks>): void {
  registered = { ...registered, ...partial };
  if (partial.resolveTenant) {
    setTenantResolver(partial.resolveTenant);
  }
}

export function getHook<K extends keyof Hooks>(name: K): Hooks[K] | undefined {
  return registered[name];
}

export function getAllHooks(): Hooks {
  return registered;
}

export function resetHooks(): void {
  registered = {};
}
