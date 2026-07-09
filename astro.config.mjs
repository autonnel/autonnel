import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { config } from 'dotenv';
config()
import { fileURLToPath } from 'url';
import path from 'path';
import { builderExtVitePlugin } from './src/integration/builder-ext-virtual.ts';
import { resolveCommitId } from './src/integration/git-commit.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paid template packs moved into autonnel-saas (D3); OSS core no longer dogfoods
// them. The free templates-starter and any pack a consumer passes to
// `autonnel({ plugins: [...] })` are wired by the integration itself.
const packAliases = {};

// https://astro.build/config
export default defineConfig({
  devToolbar: { enabled: false },
  server: {
    host: true,
    port: parseInt(process.env.PORT) || 3000,
    allowedHosts: ['localhost'],
  },
  security: {
    checkOrigin: false
  },
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [
    react(),
  ],
  output: 'server',
  vite: {
    define: {
      global: 'globalThis',
      __AUTONNEL_COMMIT__: JSON.stringify(resolveCommitId()),
    },
    server: {
      allowedHosts: true
    },
    preview: {
      allowedHosts: true,
    },
    plugins: [tailwindcss(), builderExtVitePlugin([])],
    // Pre-bundle React in one upfront pass. Aliasing the template-pack source builders
    // (served via /@fs/ from outside the root) otherwise makes Vite re-optimize deps
    // mid-load, yielding two React optimize hashes -> "more than one copy of React" and
    // broken island hydration in dev.
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        ...packAliases,
      },
      dedupe: ['react', 'react-dom'],
    },
    ssr: {
      noExternal: ['@fontsource-variable/*', '@fontsource/*'],
    },
  },
  trailingSlash: 'never',
  build:{
    format: 'file',
    inlineStylesheets: 'auto'
  }
});
