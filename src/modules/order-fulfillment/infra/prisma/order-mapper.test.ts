import { describe, it, expect } from "vitest";
import { Money } from "@/modules/shared-kernel/money";
import { Order } from "../../domain/order";
import { OfferLineSnapshot, CustomerSnapshot, ContactSnapshot, RefundRecordRef, BackendOrderRef } from "../../domain/value-objects";
import { TrackingInfo } from "../../domain/tracking-info";
import { toPrisma, toDomain } from "./order-mapper";

function order() {
  const o = Order.rehydrate({
    id: "ord_1",
    orderNumber: "1001",
    saleRef: "sale_1",
    capturedTotal: Money.of(10000, "USD"),
    lines: [
      OfferLineSnapshot.of({
        externalRef: "v1",
        title: "Item",
        quantity: 2,
        unitPrice: Money.of(5000, "USD"),
        lineTotal: Money.of(10000, "USD"),
      }),
    ],
    customer: CustomerSnapshot.of({ email: "a@b.co", name: "Ann" }),
    contact: ContactSnapshot.of({
      channel: "email",
      normalized: "a@b.co",
      hashedIdentity: "h_1",
      address: { line1: "1 St", city: "X", countryCode: "US", postalCode: "00000" },
    }),
    state: "SHIPPED" as never,
    tracking: TrackingInfo.of({ carrier: "ups", trackingNumber: "1Z", url: "u" }),
    refunds: [RefundRecordRef.of({ transactionId: "t1", amount: Money.of(500, "USD") })],
    backendOrderRef: BackendOrderRef.of("gid://o/1"),
    attribution: { sessionId: "s1" },
    note: "handle with care",
  });
  return o;
}

describe("order-mapper round-trip", () => {
  it("toPrisma then toDomain preserves the aggregate", () => {
    const row = toPrisma(order(), "tenant_x");
    expect(row.tenantId).toBe("tenant_x");
    expect(row.status).toBe("SHIPPED");
    expect(row.capturedTotal).toBe(10000);

    const back = toDomain(row);
    expect(back.id).toBe("ord_1");
    expect(back.state).toBe("SHIPPED");
    expect(back.lines[0].lineTotal.amountMinor).toBe(10000);
    expect(back.tracking?.trackingNumber).toBe("1Z");
    expect(back.refunds[0].transactionId).toBe("t1");
    expect(back.backendOrderRef?.value).toBe("gid://o/1");
    expect(back.note).toBe("handle with care");
    expect(row.contactChannel).toBe("email");
    expect(row.hashedIdentity).toBe("h_1");
    expect(back.contact?.channel).toBe("email");
    expect(back.contact?.hashedIdentity).toBe("h_1");
    expect(back.contact?.address?.line1).toBe("1 St");
  });
});
