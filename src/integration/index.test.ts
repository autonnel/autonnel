import { describe, it, expect, vi } from "vitest";
import autonnel from "./index";

describe("autonnel() integration", () => {
  it("returns an AstroIntegration that registers middleware on config:setup", () => {
    const integration = autonnel();
    expect(integration.name).toBe("autonnel");
    const addMiddleware = vi.fn();
    const updateConfig = vi.fn();
    const injectRoute = vi.fn();
    integration.hooks["astro:config:setup"]!({ addMiddleware, updateConfig, injectRoute, command: "build", config: {} } as any);
    expect(addMiddleware).toHaveBeenCalledWith(expect.objectContaining({ order: "pre", entrypoint: expect.stringContaining("middleware") }));
  });
});
