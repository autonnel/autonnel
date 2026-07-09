import type { AstroIntegration } from "astro";
import { resolveOptions, type AutonnelOptions } from "./config";
import { registerAuthoringComponents } from "./authoring-components";
import { registerPlugins } from "./register-plugins";
import { builderExtVitePlugin } from "./builder-ext-virtual";
import { enumerateCoreRoutes, filterRoutes } from "./inject-routes";
import { resolveCommitId } from "./git-commit";

export default function autonnel(options: AutonnelOptions = {}): AstroIntegration {
  const resolved = resolveOptions(options);
  return {
    name: "autonnel",
    hooks: {
      "astro:config:setup": ({ addMiddleware, updateConfig, injectRoute }: any) => {
        const mwName = import.meta.url.includes("/dist/") ? "../middleware.js" : "../middleware.ts";
        addMiddleware({ order: "pre", entrypoint: new URL(mwName, import.meta.url).pathname });
        registerAuthoringComponents();
        registerPlugins(resolved.plugins);
        updateConfig({
          vite: {
            plugins: [builderExtVitePlugin(resolved.plugins)],
            define: { __AUTONNEL_COMMIT__: JSON.stringify(resolveCommitId()) },
          },
        });

        // Inject the core console/storefront/api routes. The injected pages are core SOURCE files
        // importing via `@/...`; the consumer must resolve that alias to the package src and mark
        // the package src `ssr.noExternal` (see the autonnel-deploy-example repo). Astro's updateConfig does
        // not reliably apply a resolver plugin / alias from here, so this stays consumer-side.
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
    },
  };
}
