import { describe, it, expect } from "vitest";
import { ConfigResolutionService } from "./config-resolution";
import { SecretRef } from "./config-entry";

describe("ConfigResolutionService", () => {
  const svc = new ConfigResolutionService();

  it("prefers tenant over global over env over default", () => {
    expect(svc.resolve({ tenant: "T", global: "G", env: "E", manifestDefault: "D" })).toBe("T");
    expect(svc.resolve({ tenant: undefined, global: "G", env: "E", manifestDefault: "D" })).toBe("G");
    expect(svc.resolve({ tenant: undefined, global: undefined, env: "E", manifestDefault: "D" })).toBe("E");
    expect(svc.resolve({ tenant: undefined, global: undefined, env: undefined, manifestDefault: "D" })).toBe("D");
  });

  it("returns undefined when nothing resolves", () => {
    expect(svc.resolve({})).toBeUndefined();
  });

  it("redacts SecretRef for non-secret readers", () => {
    const v = svc.resolve({ tenant: new SecretRef("kv://stripe_key") }, { secretReader: false });
    expect(v).toBe("[REDACTED]");
  });

  it("passes SecretRef through for secret readers", () => {
    const ref = new SecretRef("kv://stripe_key");
    expect(svc.resolve({ tenant: ref }, { secretReader: true })).toBe(ref);
  });
});
