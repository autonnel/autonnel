import type { AstroUserConfig } from 'astro';
import type bundledNode from '@astrojs/node';
import type bundledReact from '@astrojs/react';
import type bundledTailwindcss from '@tailwindcss/vite';
import { createRequire } from 'node:module';
import path from 'node:path';
import autonnel from './index';
import type { AutonnelOptions } from './config';
import { REACT_DEPS, coreAtAlias, fromConsumer, tailwindCoreSource, toDir } from './cloudflare-base';

type VitePlugin = NonNullable<NonNullable<AstroUserConfig['vite']>['plugins']>[number];

// Resolved at runtime from the deployment's node_modules: sharp is native, and the generated Prisma
// client (with its query-compiler wasm) must be the deployment's own so it includes plugin models.
const NODE_EXTERNALS = ['sharp', '@prisma/client'];

export interface AutonnelNodeOptions extends AutonnelOptions {
  root: string | URL;
  outDir?: string;
  integrations?: AstroUserConfig['integrations'];
  vitePlugins?: VitePlugin[];
  aliases?: Record<string, string>;
}

// Everything else is bundled, as on Workers: the core's runtime dependencies live in the core's
// node_modules, which a deployment linking the core does not have.
export async function defineAutonnelNodeConfig(opts: AutonnelNodeOptions): Promise<AstroUserConfig> {
  const { root, outDir, integrations, vitePlugins, aliases, ...autonnelOptions } = opts;
  const require = createRequire(path.join(toDir(root), 'package.json'));
  const node = await fromConsumer<typeof bundledNode>(require, '@astrojs/node', () => import('@astrojs/node'));
  const react = await fromConsumer<typeof bundledReact>(require, '@astrojs/react', () => import('@astrojs/react'));
  const tailwindcss = await fromConsumer<typeof bundledTailwindcss>(require, '@tailwindcss/vite', () => import('@tailwindcss/vite'));
  return {
    output: 'server',
    ...(outDir ? { outDir } : {}),
    security: { checkOrigin: false },
    adapter: node({ mode: 'standalone' }),
    integrations: [react(), autonnel(autonnelOptions), ...(integrations ?? [])],
    vite: {
      build: { sourcemap: false, reportCompressedSize: false },
      optimizeDeps: { include: REACT_DEPS },
      resolve: { alias: { ...aliases }, dedupe: ['react', 'react-dom'] },
      ssr: { noExternal: true, external: NODE_EXTERNALS },
      plugins: [tailwindCoreSource(), coreAtAlias(), ...(vitePlugins ?? []), tailwindcss()] as any,
    },
    trailingSlash: 'never',
    build: { format: 'file', inlineStylesheets: 'auto' },
  };
}
