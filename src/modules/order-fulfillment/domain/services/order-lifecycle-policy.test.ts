import { describe, it, expect } from "vitest";
import { Money } from "@/modules/shared-kernel/money";
import { OrderLifecycleState } from "../order-lifecycle-state";
import { OrderLifecyclePolicy } from "./order-lifecycle-policy";

const policy = new OrderLifecyclePolicy();

describe("OrderLifecyclePolicy.advanceFulfillment", () => {
  it("advances PAID → SHIPPED", () => {
    const d = policy.advanceFulfillment(OrderLifecycleState.PAID, OrderLifecycleState.SHIPPED);
    expect(d).toEqual({ changed: true, next: OrderLifecycleState.SHIPPED });
  });

  it("is a no-op when target equals current (idempotent)", () => {
    const d = policy.advanceFulfillment(OrderLifecycleState.SHIPPED, OrderLifecycleState.SHIPPED);
    expect(d).toEqual({ changed: false, next: OrderLifecycleState.SHIPPED });
  });

  it("is a no-op when target is behind current (never regress)", () => {
    const d = policy.advanceFulfillment(OrderLifecycleState.DELIVERED, OrderLifecycleState.SHIPPED);
    expect(d).toEqual({ changed: false, next: OrderLifecycleState.DELIVERED });
  });

  it("does not touch fulfillment once in a refund state", () => {
    const d = policy.advanceFulfillment(OrderLifecycleState.REFUNDED, OrderLifecycleState.SHIPPED);
    expect(d).toEqual({ changed: false, next: OrderLifecycleState.REFUNDED });
  });
});

describe("OrderLifecyclePolicy.applyRefund", () => {
  const captured = Money.of(10000, "USD");

  it("partial refund → PARTIALLY_REFUNDED", () => {
    const d = policy.applyRefund(OrderLifecycleState.PAID, captured, Money.of(3000, "USD"));
    expect(d).toEqual({ changed: true, next: OrderLifecycleState.PARTIALLY_REFUNDED });
  });

  it("refund summing to captured total → REFUNDED", () => {
    const d = policy.applyRefund(OrderLifecycleState.PARTIALLY_REFUNDED, captured, captured);
    expect(d).toEqual({ changed: true, next: OrderLifecycleState.REFUNDED });
  });

  it("rejects refund total exceeding captured total", () => {
    expect(() =>
      policy.applyRefund(OrderLifecycleState.PAID, captured, Money.of(10001, "USD")),
    ).toThrow(/exceeds captured/i);
  });

  it("re-applying the same cumulative refund total is a no-op", () => {
    const d = policy.applyRefund(OrderLifecycleState.REFUNDED, captured, captured);
    expect(d).toEqual({ changed: false, next: OrderLifecycleState.REFUNDED });
  });
});
