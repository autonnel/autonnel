import { MQEventType } from '@/lib/adapters/mq/types';

export type EventGroup =
  | 'visitor'
  | 'pages'
  | 'cart'
  | 'checkout'
  | 'payments'
  | 'orders'
  | 'upsell'
  | 'frontend'
  | 'analysis';

export interface EventCatalogEntry {
  id: string;
  label: string;
  group: EventGroup;
}

export const EVENT_CATALOG: EventCatalogEntry[] = [
  { id: MQEventType.VISITOR_CREATED, label: 'Visitor created', group: 'visitor' },
  { id: MQEventType.VISITOR_UPDATED, label: 'Visitor updated', group: 'visitor' },

  { id: MQEventType.PAGE_VIEWED, label: 'Page viewed', group: 'pages' },
  { id: MQEventType.PAGE_LEFT, label: 'Page left', group: 'pages' },
  { id: MQEventType.ERROR_PAGE_VIEWED, label: 'Error page viewed', group: 'pages' },

  { id: MQEventType.CART_UPDATED, label: 'Cart updated', group: 'cart' },
  { id: MQEventType.FORM_STARTED, label: 'Form started', group: 'cart' },
  { id: MQEventType.FORM_SUBMITTED, label: 'Form submitted', group: 'cart' },
  { id: MQEventType.INPUT_CHANGED, label: 'Form input changed', group: 'cart' },

  { id: MQEventType.CHECKOUT_STARTED, label: 'Checkout started', group: 'checkout' },
  { id: MQEventType.CHECKOUT_COMPLETED, label: 'Checkout completed', group: 'checkout' },
  { id: MQEventType.PRODUCT_SELECTED, label: 'Product selected', group: 'checkout' },
  { id: MQEventType.FORM_VALIDATION_FAILED, label: 'Form validation failed', group: 'checkout' },
  { id: MQEventType.API_ERROR, label: 'Checkout API error', group: 'checkout' },
  { id: MQEventType.PAYMENT_ERROR, label: 'Checkout payment error', group: 'checkout' },

  { id: MQEventType.PAYMENT_INITIATED, label: 'Payment initiated', group: 'payments' },
  { id: MQEventType.PAYMENT_SUCCESS, label: 'Payment success', group: 'payments' },
  { id: MQEventType.PAYMENT_FAILED, label: 'Payment failed', group: 'payments' },
  { id: MQEventType.PAYPAL_EXPRESS_CLICK, label: 'PayPal Express clicked', group: 'payments' },
  { id: MQEventType.PAYPAL_BUTTON_CLICK, label: 'PayPal button clicked', group: 'payments' },
  { id: MQEventType.PAYPAL_CC_CLICK, label: 'PayPal CC clicked', group: 'payments' },
  { id: MQEventType.PAYPAL_PAYMENT_SUCCESS, label: 'PayPal payment success', group: 'payments' },
  { id: MQEventType.PAYPAL_PAYMENT_ERROR, label: 'PayPal payment error', group: 'payments' },

  { id: MQEventType.ORDER_CREATED, label: 'Order created', group: 'orders' },
  { id: MQEventType.ORDER_UPDATED, label: 'Order updated', group: 'orders' },
  { id: MQEventType.ORDER_PAID, label: 'Order paid', group: 'orders' },
  { id: MQEventType.ORDER_SHIPPED, label: 'Order shipped', group: 'orders' },
  { id: MQEventType.ORDER_DELIVERED, label: 'Order delivered', group: 'orders' },
  { id: MQEventType.ORDER_REFUNDED, label: 'Order refunded', group: 'orders' },
  { id: MQEventType.ORDER_PRICE_MISMATCH, label: 'Order price mismatch (live catalog)', group: 'orders' },

  { id: MQEventType.UPSELL_OFFERED, label: 'Upsell offered', group: 'upsell' },
  { id: MQEventType.UPSELL_ACCEPTED, label: 'Upsell accepted', group: 'upsell' },
  { id: MQEventType.UPSELL_DECLINED, label: 'Upsell declined', group: 'upsell' },

  { id: MQEventType.JS_ERROR, label: 'Frontend JS error', group: 'frontend' },

  { id: MQEventType.ANALYSIS_CONVERSION_COMPLETED, label: 'Conversion analysis completed', group: 'analysis' },
];

export const EVENT_CATALOG_BY_ID: ReadonlyMap<string, EventCatalogEntry> = new Map(
  EVENT_CATALOG.map((e) => [e.id, e]),
);

export function knownEventIds(): string[] {
  return EVENT_CATALOG.map((e) => e.id);
}

export const EVENT_GROUP_LABELS: Record<EventGroup, string> = {
  visitor: 'Visitor',
  pages: 'Pages',
  cart: 'Cart',
  checkout: 'Checkout',
  payments: 'Payments',
  orders: 'Orders',
  upsell: 'Upsell',
  frontend: 'Frontend',
  analysis: 'Analysis',
};
