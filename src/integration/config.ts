import type { AutonnelPlugin } from '@/lib/plugins/types';

export interface AutonnelOptions {
  plugins?: AutonnelPlugin[];
  // Patterns (exact Astro route patterns, e.g. '/login') to NOT inject from the core package.
  excludeRoutes?: string[];
  // Accepted for consumers that supply a custom tenant resolver / lifecycle hooks. Currently
  // passed through to the integration; wiring is consumer-side (SaaS middleware) for now.
  tenantResolver?: unknown;
  hooks?: unknown;
  // Module exporting `createPlugins()` (the same list as `plugins`). The server re-registers
  // from it at runtime; without it, plugin runtime members (crons, jobs, panels, hooks) are
  // live only in `astro dev`.
  pluginsModule?: string | URL;
  // Hides Autonnel branding in the console (logo, breadcrumb root, resource links, footer credit).
  whiteLabel?: boolean;
}

export const DEFAULT_OPTIONS: Required<Pick<AutonnelOptions, 'plugins' | 'excludeRoutes'>> = {
  plugins: [],
  excludeRoutes: [],
};

export interface ResolvedAutonnelOptions {
  plugins: AutonnelPlugin[];
  excludeRoutes: string[];
  pluginsModule?: string | URL;
  whiteLabel: boolean;
  tenantResolver?: unknown;
  hooks?: unknown;
}

export function resolveOptions(opts: AutonnelOptions = {}): ResolvedAutonnelOptions {
  return {
    plugins: opts.plugins ?? [],
    excludeRoutes: opts.excludeRoutes ?? [],
    pluginsModule: opts.pluginsModule,
    whiteLabel: opts.whiteLabel ?? false,
    tenantResolver: opts.tenantResolver,
    hooks: opts.hooks,
  };
}
