import { describe, it, expect } from "vitest";
import { handleResync, handleExternalDeliver } from "./order-routes";

const ctx = {
  syncFulfillmentStatus: { sweep: async () => ({ scanned: 0, advanced: 0 }) },
  markOrderDelivered: {
    execute: async (id: string) =>
      id === "missing" ? { changed: false, state: "NOT_FOUND" } : { changed: true, state: "DELIVERED" },
  },
} as never;

describe("order-routes", () => {
  it("handleResync runs the sweep and returns 200 JSON", async () => {
    const res = await handleResync(ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ scanned: 0, advanced: 0 });
  });

  it("handleExternalDeliver returns 200 with the new state", async () => {
    const res = await handleExternalDeliver(ctx, "ord_1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ changed: true, state: "DELIVERED" });
  });

  it("handleExternalDeliver returns 404 for an unknown order", async () => {
    const res = await handleExternalDeliver(ctx, "missing");
    expect(res.status).toBe(404);
  });
});
