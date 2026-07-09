import { describe, it, expect, vi } from "vitest";
import { WooCommerceFulfillmentAdapter } from "./fulfillment-adapter";
import { ExternalRef } from "../../../domain/value-objects/external-ref";

function clientReturning(order: unknown) {
  return { request: vi.fn(async () => order) } as any;
}

describe("WooCommerceFulfillmentAdapter", () => {
  it("maps a completed order to delivered", async () => {
    const adapter = new WooCommerceFulfillmentAdapter(clientReturning({ status: "completed", meta_data: [] }));
    const result = await adapter.readFulfillment(ExternalRef.of("9001"));
    expect(result.status).toBe("delivered");
  });

  it("maps tracking meta to in-transit with carrier and number", async () => {
    const adapter = new WooCommerceFulfillmentAdapter(
      clientReturning({
        status: "processing",
        meta_data: [
          { key: "_tracking_number", value: "1Z999" },
          { key: "_tracking_provider", value: "UPS" },
        ],
      }),
    );
    const result = await adapter.readFulfillment(ExternalRef.of("9001"));
    expect(result.status).toBe("in_transit");
    expect(result.carrier).toBe("UPS");
    expect(result.trackingNumber).toBe("1Z999");
  });

  it("maps an in-progress order without tracking to unfulfilled", async () => {
    const adapter = new WooCommerceFulfillmentAdapter(clientReturning({ status: "processing", meta_data: [] }));
    const result = await adapter.readFulfillment(ExternalRef.of("9001"));
    expect(result.status).toBe("unfulfilled");
  });

  it("returns unknown when the order read fails", async () => {
    const client = {
      request: vi.fn(async () => {
        throw new Error("boom");
      }),
    } as any;
    const adapter = new WooCommerceFulfillmentAdapter(client);
    const result = await adapter.readFulfillment(ExternalRef.of("9001"));
    expect(result.status).toBe("unknown");
  });
});
