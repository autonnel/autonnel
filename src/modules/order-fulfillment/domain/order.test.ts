import { describe, it, expect } from "vitest";
import { Money } from "@/modules/shared-kernel/money";
import { Order } from "./order";
import { OrderLifecycleState } from "./order-lifecycle-state";
import { OfferLineSnapshot, CustomerSnapshot, RefundRecordRef } from "./value-objects";
import { TrackingInfo } from "./tracking-info";
import { FulfillmentStatus } from "./fulfillment-status";

function newPaidOrder() {
  return Order.createFromPaidSale({
    id: "ord_1",
    orderNumber: "1001",
    saleRef: "sale_1",
    capturedTotal: Money.of(10000, "USD"),
    lines: [
      OfferLineSnapshot.of({
        externalRef: "gid://v/1",
        title: "Item",
        quantity: 1,
        unitPrice: Money.of(10000, "USD"),
        lineTotal: Money.of(10000, "USD"),
      }),
    ],
    customer: CustomerSnapshot.of({ email: "a@b.co" }),
    backendOrderRef: undefined,
    attribution: { sessionId: "s1" },
  });
}

describe("Order.createFromPaidSale", () => {
  it("creates an order at PAID and queues OrderCreated", () => {
    const order = newPaidOrder();
    expect(order.state).toBe(OrderLifecycleState.PAID);
    expect(order.saleRef).toBe("sale_1");
    const events = order.pullEvents();
    expect(events.map((e) => e.type)).toEqual(["OrderCreated"]);
  });
});

describe("Order.setNote", () => {
  it("defaults to null and trims a set note", () => {
    const order = newPaidOrder();
    expect(order.note).toBeNull();
    order.setNote("  call before delivery  ");
    expect(order.note).toBe("call before delivery");
  });

  it("clears the note for a blank value", () => {
    const order = newPaidOrder();
    order.setNote("x");
    order.setNote("   ");
    expect(order.note).toBeNull();
  });
});

describe("Order.applyFulfillment", () => {
  it("advances to SHIPPED and queues OrderShipped", () => {
    const order = newPaidOrder();
    order.pullEvents();
    const changed = order.applyFulfillment({
      backendStatus: FulfillmentStatus.IN_TRANSIT,
      tracking: TrackingInfo.of({ carrier: "ups", trackingNumber: "1Z" }),
    });
    expect(changed).toBe(true);
    expect(order.state).toBe(OrderLifecycleState.SHIPPED);
    expect(order.tracking?.trackingNumber).toBe("1Z");
    expect(order.pullEvents().map((e) => e.type)).toEqual(["OrderShipped"]);
  });

  it("PAID→DELIVERED direct transition queues only OrderDelivered", () => {
    const order = newPaidOrder();
    order.pullEvents();
    const changed = order.applyFulfillment({
      backendStatus: FulfillmentStatus.DELIVERED,
      tracking: TrackingInfo.of({ trackingNumber: "1Z" }),
    });
    expect(changed).toBe(true);
    expect(order.state).toBe(OrderLifecycleState.DELIVERED);
    expect(order.pullEvents().map((e) => e.type)).toEqual(["OrderDelivered"]);
  });

  it("re-applying the same poll is idempotent (no event)", () => {
    const order = newPaidOrder();
    order.pullEvents();
    order.applyFulfillment({
      backendStatus: FulfillmentStatus.DELIVERED,
      tracking: TrackingInfo.of({ trackingNumber: "1Z" }),
    });
    order.pullEvents();
    const changed = order.applyFulfillment({
      backendStatus: FulfillmentStatus.DELIVERED,
      tracking: TrackingInfo.of({ trackingNumber: "1Z" }),
    });
    expect(changed).toBe(false);
    expect(order.pullEvents()).toEqual([]);
  });
});

describe("Order.recordRefund", () => {
  it("partial refund moves to PARTIALLY_REFUNDED and queues OrderRefunded", () => {
    const order = newPaidOrder();
    order.pullEvents();
    const changed = order.recordRefund(
      RefundRecordRef.of({ transactionId: "txn_1", amount: Money.of(3000, "USD") }),
    );
    expect(changed).toBe(true);
    expect(order.state).toBe(OrderLifecycleState.PARTIALLY_REFUNDED);
    expect(order.pullEvents().map((e) => e.type)).toEqual(["OrderRefunded"]);
  });

  it("re-recording the same refund txn id is idempotent", () => {
    const order = newPaidOrder();
    order.pullEvents();
    const ref = RefundRecordRef.of({ transactionId: "txn_1", amount: Money.of(3000, "USD") });
    order.recordRefund(ref);
    order.pullEvents();
    const changed = order.recordRefund(ref);
    expect(changed).toBe(false);
    expect(order.pullEvents()).toEqual([]);
  });

  it("cumulative refunds reaching captured total move to REFUNDED", () => {
    const order = newPaidOrder();
    order.pullEvents();
    order.recordRefund(RefundRecordRef.of({ transactionId: "t1", amount: Money.of(3000, "USD") }));
    const changed = order.recordRefund(
      RefundRecordRef.of({ transactionId: "t2", amount: Money.of(7000, "USD") }),
    );
    expect(changed).toBe(true);
    expect(order.state).toBe(OrderLifecycleState.REFUNDED);
  });
});
