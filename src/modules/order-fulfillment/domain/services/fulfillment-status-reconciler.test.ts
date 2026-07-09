import { describe, it, expect } from "vitest";
import { OrderLifecycleState } from "../order-lifecycle-state";
import { FulfillmentStatus } from "../fulfillment-status";
import { TrackingInfo } from "../tracking-info";
import { FulfillmentStatusReconciler } from "./fulfillment-status-reconciler";

const reconciler = new FulfillmentStatusReconciler();

describe("FulfillmentStatusReconciler", () => {
  it("PAID + tracking number present + in_transit → SHIPPED", () => {
    const r = reconciler.reconcile({
      current: OrderLifecycleState.PAID,
      backendStatus: FulfillmentStatus.IN_TRANSIT,
      tracking: TrackingInfo.of({ trackingNumber: "1Z" }),
    });
    expect(r).toEqual({ target: OrderLifecycleState.SHIPPED });
  });

  it("PAID + delivered (no prior shipped seen) → DELIVERED directly", () => {
    const r = reconciler.reconcile({
      current: OrderLifecycleState.PAID,
      backendStatus: FulfillmentStatus.DELIVERED,
      tracking: TrackingInfo.of({ trackingNumber: "1Z" }),
    });
    expect(r).toEqual({ target: OrderLifecycleState.DELIVERED });
  });

  it("SHIPPED + delivered → DELIVERED", () => {
    const r = reconciler.reconcile({
      current: OrderLifecycleState.SHIPPED,
      backendStatus: FulfillmentStatus.DELIVERED,
      tracking: TrackingInfo.of({ trackingNumber: "1Z" }),
    });
    expect(r).toEqual({ target: OrderLifecycleState.DELIVERED });
  });

  it("unknown backend status → no target (conservative)", () => {
    const r = reconciler.reconcile({
      current: OrderLifecycleState.PAID,
      backendStatus: FulfillmentStatus.UNKNOWN,
      tracking: TrackingInfo.of({}),
    });
    expect(r).toEqual({ target: null });
  });

  it("in_transit but no tracking number → no target (cannot assert shipped)", () => {
    const r = reconciler.reconcile({
      current: OrderLifecycleState.PAID,
      backendStatus: FulfillmentStatus.IN_TRANSIT,
      tracking: TrackingInfo.of({}),
    });
    expect(r).toEqual({ target: null });
  });

  it("never regresses (DELIVERED + in_transit poll → no target)", () => {
    const r = reconciler.reconcile({
      current: OrderLifecycleState.DELIVERED,
      backendStatus: FulfillmentStatus.IN_TRANSIT,
      tracking: TrackingInfo.of({ trackingNumber: "1Z" }),
    });
    expect(r).toEqual({ target: null });
  });
});
