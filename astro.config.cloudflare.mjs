import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path from 'path';
import { resolveCommitId } from './src/integration/git-commit.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Resolve the Prisma generated edge runtime. In Prisma 7.8+ the generated
// `.prisma/client/` lives inside the `@prisma/client` package directory
// (pnpm puts it at `.pnpm/@prisma+client@.../node_modules/.prisma/client/`,
// not at the project's top-level `node_modules/.prisma/client/`). Resolve
// it relative to `@prisma/client` so the path stays correct regardless of
// hoisting / store hashing.
const PRISMA_CLIENT_DIR = path.dirname(require.resolve('@prisma/client/package.json'));
const PRISMA_EDGE_ENTRY = path.resolve(PRISMA_CLIENT_DIR, '../../.prisma/client/edge.js');

// Node-only packages that must not be bundled into the workerd output.
// These are lazy-loaded via dynamic import() behind `isCloudflareRuntime()`
// guards (redis cache adapter), so their chunks are never fetched at runtime
// on CF and externalizing them is safe.
//
// NOTE: `pg` is deliberately NOT in this list. `@prisma/adapter-pg` imports
// `pg` *statically* and `PrismaPg` runs on the CF Hyperdrive path
// (src/lib/db.ts), so `pg` must be bundled. With `nodejs_compat` enabled, pg's
// TCP connection works through Cloudflare's Node.js compatibility layer
// (official Prisma + Cloudflare Workers guidance). Externalizing it produced
// `Uncaught Error: No such module "chunks/pg"` at worker load time.
const NODE_ONLY_EXTERNALS = [
  'ioredis',
];

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  integrations: [react()],
  output: 'server',
  security: { checkOrigin: false },
  vite: {
    define: { global: 'globalThis', __AUTONNEL_COMMIT__: JSON.stringify(resolveCommitId()) },
    // Memory-saving knobs for the Rollup pass that bundles all SSR
    // entrypoints into a single workerd bundle. Without these the build
    // peaks above the 2 GB Node default heap (OOM on Cloudflare Workers
    // Build CI at ~1.99 GB). Sourcemaps are the biggest single hog and
    // workerd doesn't consume them; the gzipped-size report at end of build
    // allocates a copy of every chunk.
    build: {
      sourcemap: false,
      reportCompressedSize: false,
    },
    // Must mirror astro.config.mjs's React handling. Without dedupe the
    // production Rollup client build resolves react-dom's internal react to a
    // different chunk than the islands' react, yielding two React instances ->
    // "Cannot read properties of null (reading 'useEffect')" when IslandHydrator
    // calls createRoot().render() on a hooked component. (optimizeDeps only
    // affects the dev:cf server but is kept identical for parity.)
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // Prisma 7: the generated client (.prisma/client/default) uses Node.js
        // subpath imports (#main-entry-point) which Rollup can't resolve for
        // workerd. Alias directly to the edge runtime entry.
        '.prisma/client/default': PRISMA_EDGE_ENTRY,
      },
      dedupe: ['react', 'react-dom'],
    },
    ssr: {
      external: [...NODE_ONLY_EXTERNALS, 'sharp'],
      noExternal: ['@fontsource-variable/*', '@fontsource/*'],
    },
    plugins: [
      tailwindcss(),
      // autonnel runs standalone here with zero plugins; resolve the builder-ext
      // virtual module to the empty baseline (consumers supply the real one).
      {
        name: 'autonnel:builder-ext',
        resolveId(id) {
          return id === 'virtual:autonnel/builder-ext' ? '\0virtual:autonnel/builder-ext' : null;
        },
        load(id) {
          return id === '\0virtual:autonnel/builder-ext' ? 'export const builderExtensions = [];\n' : null;
        },
      },
      // The @astrojs/cloudflare adapter forcibly sets
      //   vite.ssr.noExternal = true
      //   vite.build.rollupOptions.external = ['sharp']
      // in its `astro:build:setup` hook, which wipes out anything we put
      // in `ssr.external` above. This post-hook plugin re-appends our
      // Node-only modules to rollupOptions.external so they are NOT bundled
      // into the workerd bundle. At runtime these are unreachable on CF
      // because `isCloudflareRuntime()` short-circuits the Node paths.
      // Remove once @astrojs/cloudflare stops clobbering ssr.external.
      {
        name: 'autonnel:cf-extra-externals',
        enforce: 'post',
        config(conf) {
          conf.build ??= {};
          conf.build.rollupOptions ??= {};
          const existing = conf.build.rollupOptions.external;
          if (Array.isArray(existing)) {
            conf.build.rollupOptions.external = [
              ...new Set([...existing, ...NODE_ONLY_EXTERNALS]),
            ];
          } else if (typeof existing === 'string' || existing instanceof RegExp) {
            conf.build.rollupOptions.external = [existing, ...NODE_ONLY_EXTERNALS];
          } else if (typeof existing === 'function') {
            const existingFn = existing;
            conf.build.rollupOptions.external = (id, parentId, isResolved) =>
              NODE_ONLY_EXTERNALS.includes(id) || existingFn(id, parentId, isResolved);
          } else {
            conf.build.rollupOptions.external = [...NODE_ONLY_EXTERNALS];
          }
        },
      },
    ],
  },
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'auto',
  },
});
