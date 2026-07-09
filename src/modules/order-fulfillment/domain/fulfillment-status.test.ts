import { describe, it, expect } from "vitest";
import { FulfillmentStatus, normalizeFulfillment } from "./fulfillment-status";
import { TrackingInfo } from "./tracking-info";

describe("FulfillmentStatus", () => {
  it("normalizes known backend strings", () => {
    expect(normalizeFulfillment("delivered")).toBe(FulfillmentStatus.DELIVERED);
    expect(normalizeFulfillment("in_transit")).toBe(FulfillmentStatus.IN_TRANSIT);
    expect(normalizeFulfillment("unfulfilled")).toBe(FulfillmentStatus.UNFULFILLED);
  });

  it("falls back to UNKNOWN for unmapped strings", () => {
    expect(normalizeFulfillment("weird-vendor-value")).toBe(FulfillmentStatus.UNKNOWN);
    expect(normalizeFulfillment(undefined)).toBe(FulfillmentStatus.UNKNOWN);
  });
});

describe("TrackingInfo", () => {
  it("builds with carrier + number + url", () => {
    const t = TrackingInfo.of({ carrier: "ups", trackingNumber: "1Z999", url: "https://t/1Z999" });
    expect(t.carrier).toBe("ups");
    expect(t.trackingNumber).toBe("1Z999");
    expect(t.url).toBe("https://t/1Z999");
  });

  it("hasTracking() is true only when a non-empty tracking number exists", () => {
    expect(TrackingInfo.of({ trackingNumber: "1Z999" }).hasTracking()).toBe(true);
    expect(TrackingInfo.of({}).hasTracking()).toBe(false);
    expect(TrackingInfo.of({ trackingNumber: "" }).hasTracking()).toBe(false);
  });
});
