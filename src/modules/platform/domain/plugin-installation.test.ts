import { describe, it, expect } from "vitest";
import { PluginInstallation } from "./plugin-installation";

const fresh = () =>
  PluginInstallation.install({ tenantId: "default", pluginId: "plugin-ads", version: "1.0.0", resolvedConfig: {}, capabilities: ["config:write:ads"] });

describe("PluginInstallation lifecycle", () => {
  it("installs in INSTALLED state", () => {
    expect(fresh().snapshot().status).toBe("INSTALLED");
  });

  it("enable -> disable -> enable toggles ENABLED/DISABLED", () => {
    const p = fresh();
    p.enable();
    expect(p.snapshot().status).toBe("ENABLED");
    p.disable();
    expect(p.snapshot().status).toBe("DISABLED");
    p.enable();
    expect(p.snapshot().status).toBe("ENABLED");
  });

  it("uninstall only after disable", () => {
    const p = fresh();
    p.enable();
    expect(() => p.uninstall()).toThrow(/disable/i);
    p.disable();
    p.uninstall();
    expect(p.snapshot().status).toBe("UNINSTALLED");
  });

  it("participatesAtRuntime only when ENABLED", () => {
    const p = fresh();
    expect(p.participatesAtRuntime()).toBe(false);
    p.enable();
    expect(p.participatesAtRuntime()).toBe(true);
  });
});
