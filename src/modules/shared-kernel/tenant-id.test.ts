import { describe, it, expect } from "vitest";
import { TenantId, DEFAULT_TENANT, GLOBAL_SCOPE, toTenantId } from "./tenant-id";

describe("TenantId", () => {
  it("exposes the OSS DEFAULT_TENANT sentinel", () => {
    expect(DEFAULT_TENANT).toBe("default");
    expect(TenantId.default().value).toBe("default");
  });

  it("exposes the GLOBAL scope sentinel for ConfigEntry", () => {
    expect(GLOBAL_SCOPE).toBe("__global__");
  });

  it("wraps a non-empty scalar id", () => {
    expect(TenantId.of("t_123").value).toBe("t_123");
  });

  it("rejects empty ids", () => {
    expect(() => TenantId.of("")).toThrow(/empty/i);
  });

  it("equals compares the scalar value", () => {
    expect(TenantId.of("a").equals(TenantId.of("a"))).toBe(true);
    expect(TenantId.of("a").equals(TenantId.of("b"))).toBe(false);
  });

  it("toTenantId returns the validated scalar id for downstream branded usage", () => {
    expect(toTenantId("default")).toBe("default");
    expect(toTenantId("tenant_abc")).toBe("tenant_abc");
  });

  it("toTenantId rejects empty / whitespace ids", () => {
    expect(() => toTenantId("")).toThrow(/tenant/i);
    expect(() => toTenantId("   ")).toThrow(/tenant/i);
  });
});
