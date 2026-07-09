import { describe, it, expect } from "vitest";
import { makeOrderFulfillment } from "./make-order-fulfillment";

describe("makeOrderFulfillment", () => {
  it("assembles the use-case services from injected adapters", () => {
    const ctx = makeOrderFulfillment({
      db: {} as never,
      gatewayFulfillment: { readFulfillmentStatus: async () => ({ status: "unknown" }) },
      messaging: { send: async () => {} },
      eventPublisher: { publishAll: async () => {} },
      disableNotifications: async () => true,
      newOrderId: () => "ord_x",
    });

    expect(typeof ctx.createOrderFromPaidSale.handle).toBe("function");
    expect(typeof ctx.handleRefundIssued.handle).toBe("function");
    expect(typeof ctx.syncFulfillmentStatus.sweep).toBe("function");
    expect(typeof ctx.markOrderDelivered.execute).toBe("function");
  });
});
