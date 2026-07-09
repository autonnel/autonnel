import type { SaleRef } from "./value-objects";
import type { OrderLifecycleState } from "./order-lifecycle-state";

export type OrderDomainEventType =
  | "OrderCreated"
  | "OrderShipped"
  | "OrderDelivered"
  | "OrderRefunded";

export interface OrderDomainEvent {
  type: OrderDomainEventType;
  orderId: string;
  saleRef: SaleRef;
  state: OrderLifecycleState;
}

export function orderEvent(
  type: OrderDomainEventType,
  orderId: string,
  saleRef: SaleRef,
  state: OrderLifecycleState,
): OrderDomainEvent {
  return { type, orderId, saleRef, state };
}
