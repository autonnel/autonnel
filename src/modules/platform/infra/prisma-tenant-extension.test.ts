import { describe, it, expect, vi } from "vitest";
import { buildTenantInjector } from "./prisma-tenant-extension";
import { runWithTenant } from "../../../lib/tenant/context";

describe("tenant injector", () => {
  const inject = buildTenantInjector(new Set(["UserAccount", "ConfigEntry"]));

  it("adds tenantId to a findMany where inside a tenant run", async () => {
    const query = vi.fn(async (args: any) => args);
    const out = await runWithTenant("t_1", () =>
      inject({ model: "Job", operation: "findMany", args: { where: { status: "PENDING" } }, query }),
    );
    expect(out.where.tenantId).toBe("t_1");
  });

  it("adds tenantId to a create data inside a tenant run", async () => {
    const query = vi.fn(async (args: any) => args);
    const out = await runWithTenant("t_2", () =>
      inject({ model: "Job", operation: "create", args: { data: { kind: "x" } }, query }),
    );
    expect(out.data.tenantId).toBe("t_2");
  });

  it("does NOT inject for allowlisted un-scoped models", async () => {
    const query = vi.fn(async (args: any) => args);
    const out = await runWithTenant("t_3", () =>
      inject({ model: "UserAccount", operation: "findUnique", args: { where: { email: "a@b.c" } }, query }),
    );
    expect(out.where.tenantId).toBeUndefined();
  });

  it("does NOT inject when there is no ALS context (pre-ALS webhook phase per H4)", async () => {
    const query = vi.fn(async (args: any) => args);
    const out = await inject({ model: "Job", operation: "findMany", args: { where: {} }, query });
    expect(out.where.tenantId).toBeUndefined();
  });
});
