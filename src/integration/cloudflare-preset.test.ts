import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { CORE_SRC_DIR, coreAtAlias, defineCloudflareBaseConfig, tailwindCoreSource } from "./cloudflare-base";
import { defineAutonnelCloudflareConfig } from "./cloudflare-preset";

const root = process.cwd();

function plugins(config: any): any[] {
  return (config.vite.plugins as any[]).flat().filter(Boolean);
}

function plugin(config: any, name: string): any {
  return plugins(config).find((p) => p.name === name);
}

describe("defineCloudflareBaseConfig", () => {
  it("keeps Node-only modules external and aliases the Prisma edge client", async () => {
    const config: any = await defineCloudflareBaseConfig({ root, nodeOnlyExternals: ["nodemailer"], aliases: { x: "/y" } });
    expect(config.vite.ssr.external).toEqual(["ioredis", "nodemailer", "sharp"]);
    expect(config.vite.resolve.alias[".prisma/client/default"]).toMatch(/\.prisma[\\/]client[\\/]edge\.js$/);
    expect(config.vite.resolve.alias.x).toBe("/y");
    expect(config.vite.resolve.dedupe).toEqual(["react", "react-dom"]);
    expect(config.integrations.map((i: any) => i.name)).toContain("@astrojs/react");
  });

  it("re-appends externals after the adapter overwrites rollupOptions.external", async () => {
    const config: any = await defineCloudflareBaseConfig({ root });
    const { config: hook } = plugin(config, "autonnel:cf-extra-externals");

    const fromArray: any = { build: { rollupOptions: { external: ["sharp"] } } };
    hook(fromArray);
    expect(fromArray.build.rollupOptions.external).toEqual(["sharp", "ioredis"]);

    const fromFn: any = { build: { rollupOptions: { external: (id: string) => id === "sharp" } } };
    hook(fromFn);
    const fn = fromFn.build.rollupOptions.external;
    expect([fn("sharp"), fn("ioredis"), fn("react")]).toEqual([true, true, false]);
  });

  it("only rewrites the isNode heuristic when forceEdgeRender is set", async () => {
    expect(plugin(await defineCloudflareBaseConfig({ root }), "autonnel:cf-force-edge-render")).toBeUndefined();

    const { transform } = plugin(await defineCloudflareBaseConfig({ root, forceEdgeRender: true }), "autonnel:cf-force-edge-render");
    const src = 'const isNode = typeof process !== "undefined" && Object.prototype.toString.call(process) === "[object process]";';
    expect(transform(src).code).toBe("const isNode = false;");
    expect(transform("const a = 1;")).toBeNull();
  });
});

describe("coreAtAlias", () => {
  it("resolves @/ only for core importers and importer-less entries", async () => {
    const { resolveId } = coreAtAlias() as any;
    const ctx = { resolve: vi.fn(async (id: string) => ({ id })) };
    const coreImporter = path.join(CORE_SRC_DIR, "pages/index.astro");
    const expected = path.join(CORE_SRC_DIR, "lib/db");

    expect(await resolveId.call(ctx, "@/lib/db", coreImporter, {})).toEqual({ id: expected });
    expect(await resolveId.call(ctx, "@/lib/db", undefined, {})).toEqual({ id: expected });
    expect(await resolveId.call(ctx, "@/lib/db", "/overlay/src/pages/x.astro", {})).toBeNull();
    expect(await resolveId.call(ctx, "react", coreImporter, {})).toBeNull();
  });
});

describe("tailwindCoreSource", () => {
  it("appends an @source for the core src to the core global.css only", () => {
    const { transform } = tailwindCoreSource() as any;
    const globalCss = path.join(CORE_SRC_DIR, "styles/global.css");
    expect(transform("a{}", `${globalCss}?direct`).code).toBe(`a{}\n@source "${CORE_SRC_DIR}";\n`);
    expect(transform("a{}", "/overlay/src/styles/global.css")).toBeNull();
  });
});

describe("defineAutonnelCloudflareConfig", () => {
  it("adds the autonnel integration, core resolution and the edge render fix", async () => {
    const config: any = await defineAutonnelCloudflareConfig({ root, excludeRoutes: ["/login"] });
    expect(config.integrations.map((i: any) => i.name)).toEqual(["@astrojs/react", "autonnel"]);
    expect(config.vite.ssr.noExternal[0]).toBeInstanceOf(RegExp);
    for (const name of ["autonnel:core-at-alias", "autonnel:tailwind-core-source", "autonnel:cf-force-edge-render"]) {
      expect(plugin(config, name)).toBeDefined();
    }
  });
});
