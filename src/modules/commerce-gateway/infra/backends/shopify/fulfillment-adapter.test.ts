import { describe, it, expect, vi } from "vitest";
import { ShopifyFulfillmentAdapter } from "./fulfillment-adapter";
import { ExternalRef } from "../../../domain/value-objects/external-ref";

function clientReturning(fulfillments: unknown) {
  return { query: vi.fn(async () => ({ order: { fulfillments } })) } as any;
}

describe("ShopifyFulfillmentAdapter", () => {
  it("maps an in-transit fulfillment with tracking", async () => {
    const adapter = new ShopifyFulfillmentAdapter(
      clientReturning([
        { displayStatus: "IN_TRANSIT", trackingInfo: [{ company: "USPS", number: "1Z", url: "https://t/1Z" }] },
      ]),
    );
    const result = await adapter.readFulfillment(ExternalRef.of("gid://shopify/Order/9"));
    expect(result.status).toBe("in_transit");
    expect(result.carrier).toBe("USPS");
    expect(result.trackingNumber).toBe("1Z");
  });

  it("maps a delivered fulfillment", async () => {
    const adapter = new ShopifyFulfillmentAdapter(
      clientReturning([{ displayStatus: "DELIVERED", trackingInfo: [{ number: "X" }] }]),
    );
    const result = await adapter.readFulfillment(ExternalRef.of("gid://o/1"));
    expect(result.status).toBe("delivered");
  });

  it("returns unfulfilled when there are no fulfillments", async () => {
    const adapter = new ShopifyFulfillmentAdapter(clientReturning([]));
    const result = await adapter.readFulfillment(ExternalRef.of("gid://o/1"));
    expect(result.status).toBe("unfulfilled");
  });

  it("returns unknown for an unrecognized display status (never a regression)", async () => {
    const adapter = new ShopifyFulfillmentAdapter(
      clientReturning([{ displayStatus: "WEIRD", trackingInfo: [] }]),
    );
    const result = await adapter.readFulfillment(ExternalRef.of("gid://o/1"));
    expect(result.status).toBe("unknown");
  });
});
