import { describe, it, expect } from "vitest";
import { FulfillmentStatus } from "../../domain/fulfillment-status";
import { CommerceGatewayFulfillmentReader } from "./backend-fulfillment-reader.client";

describe("CommerceGatewayFulfillmentReader", () => {
  it("normalizes the gateway's raw status + tracking into domain VOs", async () => {
    const gatewayPort = {
      readFulfillmentStatus: async (_ref: string) => ({
        status: "in_transit",
        trackingNumber: "1Z",
        trackingCarrier: "ups",
        trackingUrl: "https://t/1Z",
      }),
    };
    const reader = new CommerceGatewayFulfillmentReader(gatewayPort);

    const out = await reader.readFulfillment("gid://o/1");

    expect(out.status).toBe(FulfillmentStatus.IN_TRANSIT);
    expect(out.tracking?.trackingNumber).toBe("1Z");
    expect(out.tracking?.carrier).toBe("ups");
  });

  it("maps an unmapped status to UNKNOWN with no tracking", async () => {
    const gatewayPort = {
      readFulfillmentStatus: async () => ({ status: "weird" }),
    };
    const reader = new CommerceGatewayFulfillmentReader(gatewayPort);
    const out = await reader.readFulfillment("gid://o/2");
    expect(out.status).toBe(FulfillmentStatus.UNKNOWN);
    expect(out.tracking).toBeUndefined();
  });
});
