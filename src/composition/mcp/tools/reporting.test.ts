import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  list: vi.fn(),
  markDelivered: vi.fn(),
  loadStatsData: vi.fn(),
}));

vi.mock("@/composition/order-fulfillment-deps", () => ({
  makeOrderDashboardQuery: () => ({ list: state.list }),
  buildOrderFulfillmentDeps: () => ({}),
}));
vi.mock("@/composition/make-order-fulfillment", () => ({
  makeOrderFulfillment: () => ({ markOrderDelivered: { execute: state.markDelivered } }),
}));
vi.mock("@/composition/analytics/make-stats", () => ({ loadStatsData: state.loadStatsData }));

import { reportingTools } from "./reporting";

const ctx = { locals: {} };
const byName = (name: string) => {
  const tool = reportingTools().find((t) => t.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool;
};

const emptyPage = { items: [], total: 0, page: 1, limit: 20, totalPages: 1 };

beforeEach(() => vi.clearAllMocks());

describe("reportingTools descriptors", () => {
  it("guards orders with ORDERS and stats with ANALYTICS", () => {
    const byToolName = Object.fromEntries(reportingTools().map((t) => [t.name, t]));
    expect(Object.keys(byToolName).sort()).toEqual(["deliver_order", "get_stats", "list_orders"]);
    expect(byToolName.list_orders.requiredFeature).toBe("ORDERS");
    expect(byToolName.deliver_order.requiredFeature).toBe("ORDERS");
    expect(byToolName.get_stats.requiredFeature).toBe("ANALYTICS");
    expect(reportingTools().filter((t) => t.writeAccess).map((t) => t.name)).toEqual([
      "deliver_order",
    ]);
  });
});

describe("list_orders", () => {
  it("maps minor units to a decimal amount and passes filters through", async () => {
    state.list.mockResolvedValue({
      ...emptyPage,
      items: [
        {
          id: "o1",
          orderNumber: "20260227001",
          status: "PAID",
          saleRef: "sale_1",
          capturedTotalMinor: 3808,
          currencyCode: "USD",
          customerEmail: "j@example.com",
          customerName: "John Doe",
          trackingNumber: null,
          createdAt: "2026-02-27T12:00:00.000Z",
        },
      ],
      total: 1,
    });
    const out: any = await byName("list_orders").handler(
      { status: ["PAID"], search: "20260227001", page: 1, limit: 20 },
      ctx,
    );
    expect(state.list).toHaveBeenCalledWith(
      { status: ["PAID"], search: "20260227001" },
      1,
      20,
    );
    expect(out.orders[0]).toMatchObject({
      id: "o1",
      orderNumber: "20260227001",
      status: "PAID",
      total: 38.08,
      currency: "USD",
    });
    expect(out.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it("forwards the date range under the read model's own field names", async () => {
    state.list.mockResolvedValue(emptyPage);
    await byName("list_orders").handler({ startDate: "2026-01-01", endDate: "2026-01-31" }, ctx);
    expect(state.list).toHaveBeenCalledWith(
      { dateFrom: "2026-01-01", dateTo: "2026-01-31" },
      1,
      20,
    );
  });

  it("clamps limit to 100", async () => {
    state.list.mockResolvedValue(emptyPage);
    await byName("list_orders").handler({ limit: 5000 }, ctx);
    expect(state.list).toHaveBeenCalledWith({}, 1, 100);
  });

  it("rejects an unknown status value", () => {
    const parsed = byName("list_orders").inputSchema.safeParse({ status: ["SHIPPING"] });
    expect(parsed.success).toBe(false);
  });

  it("rejects a funnelId argument, which the read model cannot filter on", () => {
    const parsed = byName("list_orders").inputSchema.safeParse({ funnelId: "f1" });
    expect(parsed.success).toBe(false);
  });

  it("does not turn an empty status array into a { status: [] } filter", async () => {
    state.list.mockResolvedValue(emptyPage);
    await byName("list_orders").handler({ status: [] }, ctx);
    expect(state.list).toHaveBeenCalledWith({}, 1, 20);
  });
});

describe("deliver_order", () => {
  it("returns the use-case result when the order exists", async () => {
    state.markDelivered.mockResolvedValue({ changed: true, state: "DELIVERED", orderId: "o1" });
    const out: any = await byName("deliver_order").handler({ orderId: "o1" }, ctx);
    expect(state.markDelivered).toHaveBeenCalledWith("o1");
    expect(out).toEqual({ changed: true, state: "DELIVERED", orderId: "o1" });
  });

  it("raises a not-found error instead of returning NOT_FOUND as success", async () => {
    state.markDelivered.mockResolvedValue({ changed: false, state: "NOT_FOUND" });
    await expect(byName("deliver_order").handler({ orderId: "nope" }, ctx)).rejects.toThrow(/nope/);
  });

  // MarkOrderDeliveredService.execute can return changed:false without throwing whenever the
  // order was not deliverable, already delivered, or in a terminal refund state - none of those
  // are a success and none may come back as an ordinary tool result.
  it.each(["PENDING", "DELIVERED", "PARTIALLY_REFUNDED", "REFUNDED"])(
    "raises an error naming the state when changed is false and state is %s",
    async (orderState) => {
      state.markDelivered.mockResolvedValue({ changed: false, state: orderState });
      await expect(
        byName("deliver_order").handler({ orderId: "o1" }, ctx),
      ).rejects.toThrow(new RegExp(`o1.*${orderState}`, "s"));
    },
  );
});

describe("get_stats", () => {
  it("converts the date range to UTC and returns per-step rows", async () => {
    state.loadStatsData.mockResolvedValue([{ funnelId: "f1", checkoutViews: 10 }]);
    const out: any = await byName("get_stats").handler(
      { funnelId: "f1", startDate: "2026-02-01", endDate: "2026-02-28", timezone: "UTC" },
      ctx,
    );
    expect(state.loadStatsData).toHaveBeenCalledWith(
      expect.objectContaining({ funnelId: "f1" }),
    );
    const call = state.loadStatsData.mock.calls[0][0];
    expect(call.fromBucketKey).toMatch(/^2026-02-01T/);
    expect(out.stats).toEqual([{ funnelId: "f1", checkoutViews: 10 }]);
    expect(out.query.funnelId).toBe("f1");
  });

  it("defaults to the last 30 days when no range is given", async () => {
    state.loadStatsData.mockResolvedValue([]);
    const out: any = await byName("get_stats").handler({}, ctx);
    expect(state.loadStatsData).toHaveBeenCalledOnce();
    expect(out.query.funnelId).toBeNull();
    const call = state.loadStatsData.mock.calls[0][0];
    const spanDays =
      (Date.parse(call.toBucketKey) - Date.parse(call.fromBucketKey)) / 86_400_000;
    expect(spanDays).toBeGreaterThan(29);
    expect(spanDays).toBeLessThan(32);
  });

  it("rejects a malformed startDate instead of letting it surface as a server fault", async () => {
    await expect(
      byName("get_stats").handler({ startDate: "not-a-date", endDate: "2026-01-31" }, ctx),
    ).rejects.toThrow(/startDate/);
    expect(state.loadStatsData).not.toHaveBeenCalled();
  });

  it("rejects a malformed endDate instead of letting it surface as a server fault", async () => {
    await expect(
      byName("get_stats").handler({ startDate: "2026-01-01", endDate: "not-a-date" }, ctx),
    ).rejects.toThrow(/endDate/);
    expect(state.loadStatsData).not.toHaveBeenCalled();
  });

  it("rejects an invalid timezone instead of letting it surface as a server fault", async () => {
    await expect(
      byName("get_stats").handler(
        { startDate: "2026-01-01", endDate: "2026-01-31", timezone: "Not/AZone" },
        ctx,
      ),
    ).rejects.toThrow(/Not\/AZone/);
    expect(state.loadStatsData).not.toHaveBeenCalled();
  });

  it("rejects an inverted range instead of silently returning no data", async () => {
    await expect(
      byName("get_stats").handler({ startDate: "2026-02-10", endDate: "2026-02-01" }, ctx),
    ).rejects.toThrow(/2026-02-10|2026-02-01/);
    expect(state.loadStatsData).not.toHaveBeenCalled();
  });
});
