import { MQEventType } from '@/lib/adapters/mq/types';
import { EVENT_CATALOG_BY_ID } from './events-catalog';

// Bridges the outbox: domain events are published with DDD type strings (e.g. "OrderShipped"),
// but Settings -> Notifications pairings subscribe to catalog event ids (e.g. "order.shipped").
// Each emitted type maps to the catalog id(s) it should satisfy; the FIRST id is primary and
// drives the notification label + Dispatch purpose. Orders are created already-paid, so
// OrderCreated surfaces as order.paid (primary) and order.created. A refund emits BOTH
// payment.refund_issued and OrderRefunded, so only the latter maps to order.refunded to avoid
// double delivery. Types with no catalog twin (handoff/identity/ads/recall/session) map to none.
const DDD_TO_CATALOG: Record<string, string[]> = {
  OrderCreated: [MQEventType.ORDER_PAID, MQEventType.ORDER_CREATED],
  OrderShipped: [MQEventType.ORDER_SHIPPED],
  OrderDelivered: [MQEventType.ORDER_DELIVERED],
  OrderRefunded: [MQEventType.ORDER_REFUNDED],
  'payment.captured': [MQEventType.PAYMENT_SUCCESS],
  'payment.intent_created': [MQEventType.PAYMENT_INITIATED],
  'payment.failed': [MQEventType.PAYMENT_FAILED],
  CheckoutSubmitted: [MQEventType.CHECKOUT_STARTED],
  SalePaid: [MQEventType.CHECKOUT_COMPLETED],
  OneClickUpsellPaid: [MQEventType.UPSELL_ACCEPTED],
  CartUpdated: [MQEventType.CART_UPDATED],
};

// Resolves the catalog event id(s) a published envelope should match against. An envelope whose
// type is already a catalog id passes through unchanged (e.g. analysis.conversion_completed).
export function catalogEventIdsForEnvelope(envelopeType: string): string[] {
  if (EVENT_CATALOG_BY_ID.has(envelopeType)) return [envelopeType];
  return DDD_TO_CATALOG[envelopeType] ?? [];
}
