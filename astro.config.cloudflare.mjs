import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'url';
import path from 'path';
import { resolveCommitId } from './src/integration/git-commit.ts';
import { defineCloudflareBaseConfig } from './src/integration/cloudflare-base.ts';
import { runtimePluginsVitePlugin } from './src/integration/runtime-plugins-virtual.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Standalone build with zero plugins: resolve the builder-ext virtual module to the empty baseline.
const emptyBuilderExt = {
  name: 'autonnel:builder-ext',
  resolveId(id) {
    return id === 'virtual:autonnel/builder-ext' ? '\0virtual:autonnel/builder-ext' : null;
  },
  load(id) {
    return id === '\0virtual:autonnel/builder-ext' ? 'export const builderExtensions = [];\n' : null;
  },
};

// https://astro.build/config
export default defineConfig(
  await defineCloudflareBaseConfig({
    root: import.meta.url,
    aliases: { '@': path.resolve(__dirname, './src') },
    define: { __AUTONNEL_COMMIT__: JSON.stringify(resolveCommitId()) },
    // No plugins module: cf-worker's runtime-plugins import resolves to a passthrough.
    vitePlugins: [emptyBuilderExt, runtimePluginsVitePlugin('')],
  }),
);
