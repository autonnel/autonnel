import type { AstroIntegration } from "astro";
import { resolveOptions, type AutonnelOptions } from "./config";
import { registerAuthoringComponents } from "./authoring-components";
import { registerPlugins } from "./register-plugins";
import { builderExtVitePlugin } from "./builder-ext-virtual";
import { RUNTIME_PLUGINS_MODULE_ID, runtimePluginsVitePlugin } from "./runtime-plugins-virtual";
import { CORE_SRC_DIR } from "./cloudflare-base";
import { enumerateCoreRoutes, filterRoutes } from "./inject-routes";
import { resolveCommitId } from "./git-commit";
import { copyCorePublicAssets, corePublicAssetsVitePlugin } from "./core-public-assets";
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function resolvePluginsModule(pluginsModule: string | URL | undefined, root: URL): string | undefined {
  if (!pluginsModule) return undefined;
  const file =
    pluginsModule instanceof URL || pluginsModule.startsWith("file:")
      ? fileURLToPath(pluginsModule)
      : isAbsolute(pluginsModule)
        ? pluginsModule
        : resolve(fileURLToPath(root), pluginsModule);
  if (!existsSync(file)) throw new Error(`autonnel: pluginsModule not found: ${file}`);
  return file;
}

function consumerPublicDir(config: { root?: URL; publicDir?: URL }): string {
  if (config.publicDir) return fileURLToPath(config.publicDir);
  return config.root ? join(fileURLToPath(config.root), "public") : "";
}

export default function autonnel(options: AutonnelOptions = {}): AstroIntegration {
  const resolved = resolveOptions(options);
  const corePublicDir = join(CORE_SRC_DIR, "..", "public");
  return {
    name: "autonnel",
    hooks: {
      "astro:config:setup": ({ addMiddleware, updateConfig, injectRoute, config, logger }: any) => {
        const pluginsModule = resolvePluginsModule(resolved.pluginsModule, config.root);
        if (!pluginsModule && resolved.plugins.length > 0) {
          logger?.warn?.("plugins given without pluginsModule: the production server will not register them unless its entry calls registerPlugins itself");
        }
        addMiddleware({ order: "pre", entrypoint: RUNTIME_PLUGINS_MODULE_ID });
        const mwName = import.meta.url.includes("/dist/") ? "../middleware.js" : "../middleware.ts";
        addMiddleware({ order: "pre", entrypoint: new URL(mwName, import.meta.url).pathname });
        registerAuthoringComponents();
        registerPlugins(resolved.plugins);
        updateConfig({
          vite: {
            plugins: [
              builderExtVitePlugin(resolved.plugins),
              corePublicAssetsVitePlugin(corePublicDir, consumerPublicDir(config)),
              runtimePluginsVitePlugin(join(CORE_SRC_DIR, "integration/register-plugins.ts"), pluginsModule),
            ],
            define: {
              __AUTONNEL_COMMIT__: JSON.stringify(resolveCommitId()),
              __AUTONNEL_WHITE_LABEL__: JSON.stringify(resolved.whiteLabel),
            },
          },
        });

        // Inject the core console/storefront/api routes. The injected pages are core SOURCE files
        // importing via `@/...`; the consumer must resolve that alias to the package src and mark
        // the package src `ssr.noExternal` (defineAutonnelCloudflareConfig in ./cloudflare-preset does both).
        // Astro's updateConfig does not reliably apply a resolver plugin / alias from here, so this stays consumer-side.
        const routes = filterRoutes(enumerateCoreRoutes(import.meta.url), resolved.excludeRoutes);
        for (const route of routes) {
          injectRoute({ pattern: route.pattern, entrypoint: route.entrypoint });
        }

        // Inject plugin-declared routes (e.g. auth provider login/callback, the SaaS login page).
        // These bypass excludeRoutes: a consumer typically excludes a core route (e.g. /login) so a
        // plugin can serve its own page at that pattern.
        for (const plugin of resolved.plugins) {
          for (const route of plugin.routes ?? []) {
            injectRoute({ pattern: route.pattern, entrypoint: route.entrypoint });
          }
        }
      },
      "astro:build:done": ({ dir, logger }: any) => {
        const copied = copyCorePublicAssets(corePublicDir, dir);
        if (copied.length > 0) logger?.info?.(`copied ${copied.length} core public assets`);
      },
    },
  };
}
