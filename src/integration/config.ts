import type { AutonnelPlugin } from '@/lib/plugins/types';

export interface AutonnelOptions {
  plugins?: AutonnelPlugin[];
  // Patterns (exact Astro route patterns, e.g. '/login') to NOT inject from the core package.
  excludeRoutes?: string[];
  // Accepted for consumers that supply a custom tenant resolver / lifecycle hooks. Currently
  // passed through to the integration; wiring is consumer-side (SaaS middleware) for now.
  tenantResolver?: unknown;
  hooks?: unknown;
}

export const DEFAULT_OPTIONS: Required<Pick<AutonnelOptions, 'plugins' | 'excludeRoutes'>> = {
  plugins: [],
  excludeRoutes: [],
};

export interface ResolvedAutonnelOptions {
  plugins: AutonnelPlugin[];
  excludeRoutes: string[];
  tenantResolver?: unknown;
  hooks?: unknown;
}

export function resolveOptions(opts: AutonnelOptions = {}): ResolvedAutonnelOptions {
  return {
    plugins: opts.plugins ?? [],
    excludeRoutes: opts.excludeRoutes ?? [],
    tenantResolver: opts.tenantResolver,
    hooks: opts.hooks,
  };
}
