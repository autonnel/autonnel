export const OrderLifecycleState = {
  PENDING: "PENDING",
  PAID: "PAID",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
  REFUNDED: "REFUNDED",
} as const;

export type OrderLifecycleState =
  (typeof OrderLifecycleState)[keyof typeof OrderLifecycleState];

const FULFILLMENT_FORWARD: OrderLifecycleState[] = [
  OrderLifecycleState.SHIPPED,
  OrderLifecycleState.DELIVERED,
];

const FULFILLMENT_RANK: Record<string, number> = {
  [OrderLifecycleState.PENDING]: 0,
  [OrderLifecycleState.PAID]: 1,
  [OrderLifecycleState.SHIPPED]: 2,
  [OrderLifecycleState.DELIVERED]: 3,
};

const REFUND_STATES: OrderLifecycleState[] = [
  OrderLifecycleState.PARTIALLY_REFUNDED,
  OrderLifecycleState.REFUNDED,
];

export function isFulfillmentForward(s: OrderLifecycleState): boolean {
  return FULFILLMENT_FORWARD.includes(s);
}

export function isRefundState(s: OrderLifecycleState): boolean {
  return REFUND_STATES.includes(s);
}

// Same-state allowed so re-applying an idempotent fact is a no-op, not a throw.
export function canTransition(
  from: OrderLifecycleState,
  to: OrderLifecycleState,
): boolean {
  if (from === to) return true;

  if (isRefundState(to)) {
    const paidOrLater =
      from === OrderLifecycleState.PAID ||
      isFulfillmentForward(from) ||
      from === OrderLifecycleState.PARTIALLY_REFUNDED;
    if (!paidOrLater) return false;
    if (from === OrderLifecycleState.REFUNDED) return false;
    if (from === OrderLifecycleState.PARTIALLY_REFUNDED) {
      return to === OrderLifecycleState.REFUNDED;
    }
    return true;
  }

  const fromRank = FULFILLMENT_RANK[from];
  const toRank = FULFILLMENT_RANK[to];
  if (fromRank === undefined || toRank === undefined) return false;
  if (fromRank === 0) return false;
  return toRank > fromRank;
}
