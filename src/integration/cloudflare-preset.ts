import type { AstroUserConfig } from 'astro';
import autonnel from './index';
import type { AutonnelOptions } from './config';
import { coreAtAlias, defineCloudflareBaseConfig, tailwindCoreSource, type CloudflareBaseOptions } from './cloudflare-base';

export { coreAtAlias, defineCloudflareBaseConfig, tailwindCoreSource, type CloudflareBaseOptions } from './cloudflare-base';

export type AutonnelCloudflareOptions = AutonnelOptions & Omit<CloudflareBaseOptions, 'dedupe'>;

export function defineAutonnelCloudflareConfig(opts: AutonnelCloudflareOptions): Promise<AstroUserConfig> {
  const { root, integrations, vitePlugins, aliases, define, nodeOnlyExternals, noExternal, forceEdgeRender, ...autonnelOptions } = opts;
  return defineCloudflareBaseConfig({
    root,
    integrations: [autonnel(autonnelOptions), ...(integrations ?? [])],
    vitePlugins: [tailwindCoreSource(), coreAtAlias(), ...(vitePlugins ?? [])],
    aliases,
    define,
    nodeOnlyExternals,
    noExternal: [/[\\/]autonnel[\\/]src[\\/]/, ...(noExternal ?? [])],
    forceEdgeRender: forceEdgeRender ?? true,
    // Core src (e.g. autonnel/cf-worker) must bind to the consumer's adapter, not the core's copy.
    dedupe: ['@astrojs/cloudflare'],
  });
}
