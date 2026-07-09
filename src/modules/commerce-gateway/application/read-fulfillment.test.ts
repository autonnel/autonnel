import { describe, it, expect, vi } from "vitest";
import { ReadFulfillmentStatusService } from "./read-fulfillment-status.service";
import { ExternalRef } from "../domain/value-objects/external-ref";
import type { BackendFulfillmentReaderPort } from "./ports/outbound";

describe("ReadFulfillmentStatusService", () => {
  it("reads and returns normalized tracking from the vendor reader", async () => {
    const reader: BackendFulfillmentReaderPort = {
      readFulfillment: vi.fn(async () => ({
        status: "in_transit" as const,
        carrier: "USPS",
        trackingNumber: "1Z",
        trackingUrl: "https://t/1Z",
      })),
    };
    const svc = new ReadFulfillmentStatusService(reader);
    const result = await svc.readFulfillmentStatus("gid://order/9");
    expect(result.status).toBe("in_transit");
    expect(result.trackingNumber).toBe("1Z");
    expect(reader.readFulfillment).toHaveBeenCalledWith(expect.any(ExternalRef));
  });

  it("returns unknown when the vendor cannot resolve status", async () => {
    const reader: BackendFulfillmentReaderPort = {
      readFulfillment: vi.fn(async () => ({ status: "unknown" as const })),
    };
    const svc = new ReadFulfillmentStatusService(reader);
    const result = await svc.readFulfillmentStatus("gid://order/none");
    expect(result.status).toBe("unknown");
  });
});
