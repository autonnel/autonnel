import { describe, it, expect } from "vitest";
import { makeEnvelope } from "./event-envelope";

describe("event-envelope", () => {
  it("wraps a payload with type, tenantId, occurredAt and a stable id", () => {
    const e = makeEnvelope("PaymentCaptured", "default", { saleRef: "s1" }, { sessionId: "sess1" });
    expect(e.type).toBe("PaymentCaptured");
    expect(e.tenantId).toBe("default");
    expect(e.payload).toEqual({ saleRef: "s1" });
    expect(e.correlation.sessionId).toBe("sess1");
    expect(typeof e.eventId).toBe("string");
    expect(e.occurredAt).toBeInstanceOf(Date);
  });
});
