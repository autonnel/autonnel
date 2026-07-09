import { Money } from "@/modules/shared-kernel/money";
import {
  OrderLifecycleState,
  canTransition,
  isRefundState,
} from "../order-lifecycle-state";

export interface LifecycleDecision {
  changed: boolean;
  next: OrderLifecycleState;
}

export class IllegalRefundError extends Error {}

export class OrderLifecyclePolicy {
  advanceFulfillment(
    current: OrderLifecycleState,
    target: OrderLifecycleState,
  ): LifecycleDecision {
    if (isRefundState(current)) return { changed: false, next: current };
    if (current === target) return { changed: false, next: current };
    if (!canTransition(current, target)) return { changed: false, next: current };
    return { changed: true, next: target };
  }

  // cumulativeRefunded is the running total of all refunds (including this one).
  applyRefund(
    current: OrderLifecycleState,
    capturedTotal: Money,
    cumulativeRefunded: Money,
  ): LifecycleDecision {
    if (cumulativeRefunded.amountMinor > capturedTotal.amountMinor) {
      throw new IllegalRefundError(
        `Refund total ${cumulativeRefunded.amountMinor} exceeds captured total ${capturedTotal.amountMinor}`,
      );
    }
    const target =
      cumulativeRefunded.amountMinor >= capturedTotal.amountMinor
        ? OrderLifecycleState.REFUNDED
        : OrderLifecycleState.PARTIALLY_REFUNDED;

    if (current === target) return { changed: false, next: current };
    if (!canTransition(current, target)) return { changed: false, next: current };
    return { changed: true, next: target };
  }
}
