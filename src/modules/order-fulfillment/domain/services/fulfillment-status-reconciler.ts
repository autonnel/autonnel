import { OrderLifecycleState, canTransition } from "../order-lifecycle-state";
import { FulfillmentStatus } from "../fulfillment-status";
import { TrackingInfo } from "../tracking-info";

export interface ReconcileInput {
  current: OrderLifecycleState;
  backendStatus: FulfillmentStatus;
  tracking: TrackingInfo;
}

export interface ReconcileResult {
  target: OrderLifecycleState | null;
}

export class FulfillmentStatusReconciler {
  reconcile(input: ReconcileInput): ReconcileResult {
    const desired = this.desiredState(input);
    if (desired === null) return { target: null };
    if (input.current === desired) return { target: null };
    if (!canTransition(input.current, desired)) return { target: null };
    return { target: desired };
  }

  private desiredState(input: ReconcileInput): OrderLifecycleState | null {
    switch (input.backendStatus) {
      case FulfillmentStatus.DELIVERED:
        return OrderLifecycleState.DELIVERED;
      case FulfillmentStatus.IN_TRANSIT:
        // A tracking number is required before we may assert SHIPPED.
        return input.tracking.hasTracking() ? OrderLifecycleState.SHIPPED : null;
      default:
        return null;
    }
  }
}
