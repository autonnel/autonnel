import type { TenantContext, TenantResolver } from './types';
import { DEFAULT_TENANT } from './default';

interface TenantResolverState {
  resolver: TenantResolver;
}

const STATE_KEY = Symbol.for('autonnel.tenant.resolver.state');

function getState(): TenantResolverState {
  const g = globalThis as unknown as { [k: symbol]: TenantResolverState | undefined };
  let state = g[STATE_KEY];
  if (!state) {
    state = { resolver: () => DEFAULT_TENANT };
    g[STATE_KEY] = state;
  }
  return state;
}

export function setTenantResolver(fn: TenantResolver): void {
  getState().resolver = fn;
}

export function resetTenantResolver(): void {
  getState().resolver = () => DEFAULT_TENANT;
}

export async function resolveTenant(request: Request): Promise<TenantContext> {
  return Promise.resolve(getState().resolver(request));
}

export function getTenantResolver(): TenantResolver {
  return getState().resolver;
}
