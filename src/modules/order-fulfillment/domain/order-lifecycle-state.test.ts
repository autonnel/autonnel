import { describe, it, expect } from "vitest";
import {
  OrderLifecycleState,
  isFulfillmentForward,
  canTransition,
} from "./order-lifecycle-state";

describe("OrderLifecycleState", () => {
  it("enumerates the six lifecycle states", () => {
    expect(Object.values(OrderLifecycleState)).toEqual([
      "PENDING",
      "PAID",
      "SHIPPED",
      "DELIVERED",
      "PARTIALLY_REFUNDED",
      "REFUNDED",
    ]);
  });

  it("allows monotonic forward fulfillment transitions", () => {
    expect(canTransition(OrderLifecycleState.PAID, OrderLifecycleState.SHIPPED)).toBe(true);
    expect(canTransition(OrderLifecycleState.SHIPPED, OrderLifecycleState.DELIVERED)).toBe(true);
    expect(canTransition(OrderLifecycleState.PAID, OrderLifecycleState.DELIVERED)).toBe(true);
  });

  it("rejects backward fulfillment transitions", () => {
    expect(canTransition(OrderLifecycleState.DELIVERED, OrderLifecycleState.SHIPPED)).toBe(false);
    expect(canTransition(OrderLifecycleState.SHIPPED, OrderLifecycleState.PAID)).toBe(false);
    expect(canTransition(OrderLifecycleState.PAID, OrderLifecycleState.PENDING)).toBe(false);
  });

  it("treats same-state as a no-op (idempotent), not illegal", () => {
    expect(canTransition(OrderLifecycleState.SHIPPED, OrderLifecycleState.SHIPPED)).toBe(true);
  });

  it("allows refund branch from any post-PAID fulfillment state", () => {
    expect(canTransition(OrderLifecycleState.PAID, OrderLifecycleState.PARTIALLY_REFUNDED)).toBe(true);
    expect(canTransition(OrderLifecycleState.DELIVERED, OrderLifecycleState.REFUNDED)).toBe(true);
    expect(canTransition(OrderLifecycleState.PARTIALLY_REFUNDED, OrderLifecycleState.REFUNDED)).toBe(true);
  });

  it("rejects refund before PAID", () => {
    expect(canTransition(OrderLifecycleState.PENDING, OrderLifecycleState.REFUNDED)).toBe(false);
  });

  it("classifies fulfillment-forward states", () => {
    expect(isFulfillmentForward(OrderLifecycleState.SHIPPED)).toBe(true);
    expect(isFulfillmentForward(OrderLifecycleState.REFUNDED)).toBe(false);
  });
});
