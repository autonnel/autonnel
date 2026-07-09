import { describe, it, expect, vi } from "vitest";
import { runWithTenant, getCurrentTenantId, tryGetTenantId } from "./context";
import { DEFAULT_TENANT } from "../../modules/shared-kernel";

describe("tenant context (ALS)", () => {
  it("exposes the active tenant inside runWithTenant", () => {
    runWithTenant("t_1", () => {
      expect(getCurrentTenantId()).toBe("t_1");
    });
  });

  it("nested runs override and restore", () => {
    runWithTenant("outer", () => {
      runWithTenant("inner", () => expect(getCurrentTenantId()).toBe("inner"));
      expect(getCurrentTenantId()).toBe("outer");
    });
  });

  it("getCurrentTenantId falls back to DEFAULT_TENANT outside any run (OSS single-tenant)", () => {
    expect(getCurrentTenantId()).toBe(DEFAULT_TENANT);
  });

  it("tryGetTenantId returns undefined outside any run", () => {
    expect(tryGetTenantId()).toBeUndefined();
  });

  // Regression: Vite dev HMR re-evaluates this module on edits. The store must survive that, or
  // middleware writes the principal into one ALS instance while page code reads another (empty),
  // silently logging the admin out after every save. Re-evaluating must reuse the same store.
  it("shares one ALS across module re-evaluation (dev HMR cannot split the store)", async () => {
    const first = await import("./context");
    vi.resetModules();
    const second = await import("./context");

    first.runWithTenant("hmr_survivor", () => {
      expect(second.getCurrentTenantId()).toBe("hmr_survivor");
    });
  });
});
