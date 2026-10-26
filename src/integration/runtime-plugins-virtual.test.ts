import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import autonnel from "./index";
import { generateRuntimePluginsModuleSource, runtimePluginsVitePlugin, RUNTIME_PLUGINS_MODULE_ID } from "./runtime-plugins-virtual";

describe("runtime plugins module", () => {
  it("is a passthrough middleware that registers nothing without a plugins module", () => {
    const src = generateRuntimePluginsModuleSource("/core/register-plugins.ts");
    expect(src).not.toContain("registerPlugins");
    expect(src).toContain("export const onRequest");
  });

  it("re-registers the plugins module at runtime without the engine check", () => {
    const src = generateRuntimePluginsModuleSource("/core/register-plugins.ts", "/app/src/plugins.ts");
    expect(src).toContain('import { registerPlugins } from "/core/register-plugins.ts";');
    expect(src).toContain('import * as pluginsModule from "/app/src/plugins.ts";');
    expect(src).toContain("registerPlugins(pluginsModule.createPlugins(), { checkEngines: false });");
    expect(src).toContain("export const onRequest");
  });

  it("resolves only its own virtual id", () => {
    const plugin = runtimePluginsVitePlugin("/core/register-plugins.ts");
    expect(plugin.resolveId(RUNTIME_PLUGINS_MODULE_ID)).toBe("\0" + RUNTIME_PLUGINS_MODULE_ID);
    expect(plugin.resolveId("react")).toBeNull();
    expect(plugin.load("\0" + RUNTIME_PLUGINS_MODULE_ID)).toContain("onRequest");
  });
});

function setup(options: Parameters<typeof autonnel>[0], root: URL) {
  const addMiddleware = vi.fn();
  const updateConfig = vi.fn();
  const logger = { warn: vi.fn() };
  autonnel(options).hooks["astro:config:setup"]!({ addMiddleware, updateConfig, injectRoute: vi.fn(), config: { root }, logger } as any);
  const vitePlugins = updateConfig.mock.calls[0][0].vite.plugins as any[];
  const runtime = vitePlugins.find((p) => p.name === "autonnel:runtime-plugins");
  return { addMiddleware, logger, source: runtime.load("\0" + RUNTIME_PLUGINS_MODULE_ID) as string };
}

describe("autonnel() pluginsModule", () => {
  const dir = mkdtempSync(join(tmpdir(), "autonnel-plugins-"));
  writeFileSync(join(dir, "plugins.ts"), "export function createPlugins() { return []; }\n");
  const root = pathToFileURL(dir + "/");

  it("adds the runtime plugins middleware ahead of the core middleware", () => {
    const { addMiddleware } = setup({ pluginsModule: "plugins.ts" }, root);
    expect(addMiddleware.mock.calls[0][0]).toEqual({ order: "pre", entrypoint: RUNTIME_PLUGINS_MODULE_ID });
    expect(addMiddleware.mock.calls[1][0].entrypoint).toMatch(/middleware\.(ts|js)$/);
  });

  it("resolves a relative path against the project root and accepts a URL", () => {
    expect(setup({ pluginsModule: "plugins.ts" }, root).source).toContain(JSON.stringify(join(dir, "plugins.ts")));
    expect(setup({ pluginsModule: new URL("plugins.ts", root) }, root).source).toContain(JSON.stringify(join(dir, "plugins.ts")));
  });

  it("fails the build when the plugins module does not exist", () => {
    expect(() => setup({ pluginsModule: "missing.ts" }, root)).toThrow(/pluginsModule not found/);
  });

  it("warns when plugins are given without a plugins module", () => {
    const { logger, source } = setup({ plugins: [{ name: "p", version: "1.0.0" }] }, root);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/without pluginsModule/));
    expect(source).not.toContain("registerPlugins");
  });
});
