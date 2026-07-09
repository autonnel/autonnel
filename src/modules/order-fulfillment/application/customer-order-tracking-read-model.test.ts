import { describe, it, expect } from "vitest";
import {
  CustomerOrderTrackingService,
  InvalidTrackingEmailError,
  isValidEmail,
  type CustomerOrderTrackingReadPort,
  type TrackedOrderView,
} from "./customer-order-tracking-read-model";

function view(over: Partial<TrackedOrderView> = {}): TrackedOrderView {
  return {
    id: "ord_1",
    orderNumber: "1001",
    status: "PAID",
    createdAt: "2026-01-01T00:00:00.000Z",
    capturedTotalMinor: 9719,
    currencyCode: "USD",
    customerName: "John Doe",
    items: [{ externalRef: "v1", title: "Bundle", quantity: 1, unitPriceMinor: 8999 }],
    trackingNumber: null,
    trackingCarrier: null,
    trackingUrl: null,
    ...over,
  };
}

function fakePort(
  calls: { email?: string; orderNumber?: string },
  result: TrackedOrderView | null,
): CustomerOrderTrackingReadPort {
  return {
    async byEmailAndNumber(email, orderNumber) {
      calls.email = email;
      calls.orderNumber = orderNumber;
      return result;
    },
  };
}

describe("isValidEmail", () => {
  it("accepts a well-formed address and rejects garbage", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
});

describe("CustomerOrderTrackingService", () => {
  it("normalizes the email and trims the order number before querying", async () => {
    const calls: { email?: string; orderNumber?: string } = {};
    const svc = new CustomerOrderTrackingService(fakePort(calls, view()));

    const result = await svc.track("  John@Example.COM ", "  1001 ");

    expect(calls.email).toBe("john@example.com");
    expect(calls.orderNumber).toBe("1001");
    expect(result?.orderNumber).toBe("1001");
  });

  it("returns null (not-found, no PII) when the order number is missing", async () => {
    let touched = false;
    const port: CustomerOrderTrackingReadPort = {
      async byEmailAndNumber() {
        touched = true;
        return view();
      },
    };
    const svc = new CustomerOrderTrackingService(port);

    expect(await svc.track("a@b.co", "")).toBeNull();
    expect(await svc.track("a@b.co", "   ")).toBeNull();
    expect(touched).toBe(false);
  });

  it("rejects an invalid email without touching the port", async () => {
    let touched = false;
    const port: CustomerOrderTrackingReadPort = {
      async byEmailAndNumber() {
        touched = true;
        return null;
      },
    };
    const svc = new CustomerOrderTrackingService(port);
    await expect(svc.track("not-an-email", "1001")).rejects.toBeInstanceOf(InvalidTrackingEmailError);
    expect(touched).toBe(false);
  });
});
