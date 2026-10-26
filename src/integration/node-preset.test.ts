import { describe, it, expect } from "vitest";
import { defineAutonnelNodeConfig } from "./node-preset";

describe("defineAutonnelNodeConfig", () => {
  it("bundles everything except the native and generated-client packages", async () => {
    const config: any = await defineAutonnelNodeConfig({ root: process.cwd(), outDir: "./dist-node" });
    expect(config.vite.ssr).toEqual({ noExternal: true, external: ["sharp", "@prisma/client"] });
    expect(config.outDir).toBe("./dist-node");
    expect(config.adapter.name).toBe("@astrojs/node");
  });

  it("adds the autonnel integration and the core source resolution plugins", async () => {
    const config: any = await defineAutonnelNodeConfig({ root: process.cwd() });
    expect(config.integrations.map((i: any) => i.name)).toEqual(["@astrojs/react", "autonnel"]);
    const names = (config.vite.plugins as any[]).flat().map((p) => p?.name);
    expect(names).toEqual(expect.arrayContaining(["autonnel:core-at-alias", "autonnel:tailwind-core-source"]));
    expect(config.vite.resolve.dedupe).toEqual(["react", "react-dom"]);
  });
});
