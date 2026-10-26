import type { AstroIntegration, AstroUserConfig } from 'astro';
import type bundledCloudflare from '@astrojs/cloudflare';
import type bundledReact from '@astrojs/react';
import type bundledTailwindcss from '@tailwindcss/vite';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

type VitePlugin = NonNullable<NonNullable<AstroUserConfig['vite']>['plugins']>[number];

// Lazy-loaded behind isCloudflareRuntime() guards, so their chunks are never fetched on workerd.
// `pg` must stay bundled: @prisma/adapter-pg imports it statically on the Hyperdrive path.
const DEFAULT_NODE_ONLY_EXTERNALS = ['ioredis'];

export const CORE_SRC_DIR = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src'));

export const REACT_DEPS = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'];

export interface CloudflareBaseOptions {
  // Consumer project root (pass `import.meta.url` of the astro config); the Prisma client is resolved from here.
  root: string | URL;
  integrations?: AstroIntegration[];
  vitePlugins?: VitePlugin[];
  aliases?: Record<string, string>;
  define?: Record<string, string>;
  nodeOnlyExternals?: string[];
  noExternal?: (string | RegExp)[];
  forceEdgeRender?: boolean;
  dedupe?: string[];
}

export function toDir(root: string | URL): string {
  const p = root instanceof URL || root.startsWith('file:') ? fileURLToPath(root) : root;
  return path.extname(p) ? path.dirname(p) : p;
}

// Build tooling must be the consumer's own copy so an overlay build matches its lockfile;
// the package's bundled copy is only a fallback when the consumer does not install one.
export async function fromConsumer<T>(require: NodeRequire, id: string, fallback: () => Promise<{ default: T }>): Promise<T> {
  let file: string;
  try {
    file = require.resolve(id);
  } catch {
    return (await fallback()).default;
  }
  const mod = await import(pathToFileURL(file).href);
  return (mod.default ?? mod) as T;
}

// Prisma 7: `.prisma/client/default` uses Node subpath imports Rollup can't resolve for workerd.
// A consumer without its own schema falls back to the core's generated client.
function prismaEdgeEntry(require: NodeRequire): string {
  let clientPkg: string;
  try {
    clientPkg = require.resolve('@prisma/client/package.json');
  } catch {
    clientPkg = createRequire(path.join(CORE_SRC_DIR, '../package.json')).resolve('@prisma/client/package.json');
  }
  return path.resolve(path.dirname(clientPkg), '../../.prisma/client/edge.js');
}

// @astrojs/cloudflare overwrites ssr.external / rollupOptions.external in astro:build:setup;
// re-append the Node-only modules afterwards so they stay out of the workerd bundle.
function cfExtraExternals(externals: string[]): VitePlugin {
  return {
    name: 'autonnel:cf-extra-externals',
    enforce: 'post',
    config(conf: any) {
      conf.build ??= {};
      conf.build.rollupOptions ??= {};
      const existing = conf.build.rollupOptions.external;
      if (Array.isArray(existing)) {
        conf.build.rollupOptions.external = [...new Set([...existing, ...externals])];
      } else if (typeof existing === 'string' || existing instanceof RegExp) {
        conf.build.rollupOptions.external = [existing, ...externals];
      } else if (typeof existing === 'function') {
        conf.build.rollupOptions.external = (id: string, parentId: string | undefined, isResolved: boolean) =>
          externals.includes(id) || existing(id, parentId, isResolved);
      } else {
        conf.build.rollupOptions.external = [...externals];
      }
    },
  };
}

// Astro's isNode heuristic is true under nodejs_compat, so renderPage returns an async iterable
// body that workerd stringifies to "[object Object]". Tree-shake it to false to force the stream path.
function forceEdgeRenderPlugin(): VitePlugin {
  const needle = 'typeof process !== "undefined" && Object.prototype.toString.call(process) === "[object process]"';
  return {
    name: 'autonnel:cf-force-edge-render',
    enforce: 'pre',
    transform(code: string) {
      if (!code.includes(needle)) return null;
      return { code: code.split(needle).join('false'), map: null };
    },
  };
}

function isUnderCore(file: string): boolean {
  return file.replace(/\\/g, '/').startsWith(CORE_SRC_DIR.replace(/\\/g, '/') + '/');
}

// Injected core pages import via `@/...`, and resolve.alias does not apply to a noExternal'd
// out-of-root package. Entries without an importer (client:only islands) are core too, so an
// overlay must not use the `@/` prefix for its own modules.
export function coreAtAlias(): VitePlugin {
  return {
    name: 'autonnel:core-at-alias',
    enforce: 'pre',
    async resolveId(this: any, id: string, importer: string | undefined, options: any) {
      if (!id.startsWith('@/')) return null;
      if (importer && !isUnderCore(importer)) return null;
      return this.resolve(path.resolve(CORE_SRC_DIR, id.slice(2)), importer, { ...options, skipSelf: true });
    },
  };
}

// Tailwind only scans the Vite root; the core src sits outside it in an overlay build.
export function tailwindCoreSource(): VitePlugin {
  const globalCss = path.join(CORE_SRC_DIR, 'styles/global.css').replace(/\\/g, '/');
  const source = CORE_SRC_DIR.replace(/\\/g, '/');
  return {
    name: 'autonnel:tailwind-core-source',
    enforce: 'pre',
    transform(code: string, id: string) {
      if (id.replace(/\\/g, '/').split('?')[0] !== globalCss) return null;
      return { code: `${code}\n@source "${source}";\n`, map: null };
    },
  };
}

export async function defineCloudflareBaseConfig(opts: CloudflareBaseOptions): Promise<AstroUserConfig> {
  const externals = [...new Set([...DEFAULT_NODE_ONLY_EXTERNALS, ...(opts.nodeOnlyExternals ?? [])])];
  const require = createRequire(path.join(toDir(opts.root), 'package.json'));
  const cloudflare = await fromConsumer<typeof bundledCloudflare>(require, '@astrojs/cloudflare', () => import('@astrojs/cloudflare'));
  const react = await fromConsumer<typeof bundledReact>(require, '@astrojs/react', () => import('@astrojs/react'));
  const tailwindcss = await fromConsumer<typeof bundledTailwindcss>(require, '@tailwindcss/vite', () => import('@tailwindcss/vite'));
  return {
    output: 'server',
    security: { checkOrigin: false },
    adapter: cloudflare(),
    integrations: [react(), ...(opts.integrations ?? [])],
    vite: {
      define: { global: 'globalThis', ...opts.define },
      // workerd ignores sourcemaps; both knobs keep the single-bundle Rollup pass under the CI heap.
      build: { sourcemap: false, reportCompressedSize: false },
      // Without React dedupe the client build gets two React copies and island hydration crashes.
      optimizeDeps: { include: REACT_DEPS },
      resolve: {
        alias: { '.prisma/client/default': prismaEdgeEntry(require), ...opts.aliases },
        dedupe: ['react', 'react-dom', ...(opts.dedupe ?? [])],
      },
      ssr: {
        external: [...externals, 'sharp'],
        noExternal: [...(opts.noExternal ?? []), '@fontsource-variable/*', '@fontsource/*'],
      },
      plugins: [
        ...(opts.vitePlugins ?? []),
        tailwindcss(),
        ...(opts.forceEdgeRender ? [forceEdgeRenderPlugin()] : []),
        cfExtraExternals(externals),
      ] as any,
    },
    trailingSlash: 'never',
    build: { format: 'file', inlineStylesheets: 'auto' },
  };
}
