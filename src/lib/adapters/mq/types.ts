export enum MQEventType {
  VISITOR_CREATED = 'visitor.created',
  VISITOR_UPDATED = 'visitor.updated',

  PAGE_VIEWED = 'page.viewed',
  PAGE_LEFT = 'page.left',
  ERROR_PAGE_VIEWED = 'error.page_viewed',

  FORM_STARTED = 'form.started',
  FORM_SUBMITTED = 'form.submitted',
  INPUT_CHANGED = 'form.input_changed',
  CART_UPDATED = 'cart.updated',

  CHECKOUT_STARTED = 'checkout.started',
  CHECKOUT_COMPLETED = 'checkout.completed',
  PRODUCT_SELECTED = 'checkout.product_selected',
  FORM_VALIDATION_FAILED = 'checkout.form_validation_failed',
  API_ERROR = 'checkout.api_error',
  PAYMENT_ERROR = 'checkout.payment_error',

  PAYMENT_INITIATED = 'payment.initiated',
  PAYMENT_SUCCESS = 'payment.success',
  PAYMENT_FAILED = 'payment.failed',
  PAYPAL_EXPRESS_CLICK = 'payment.paypal_express_click',
  PAYPAL_BUTTON_CLICK = 'payment.paypal_button_click',
  PAYPAL_CC_CLICK = 'payment.paypal_cc_click',
  PAYPAL_PAYMENT_SUCCESS = 'payment.paypal_success',
  PAYPAL_PAYMENT_ERROR = 'payment.paypal_error',

  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_PAID = 'order.paid',
  ORDER_SHIPPED = 'order.shipped',
  ORDER_DELIVERED = 'order.delivered',
  ORDER_REFUNDED = 'order.refunded',
  ORDER_PRICE_MISMATCH = 'order.price_mismatch',

  UPSELL_OFFERED = 'upsell.offered',
  UPSELL_ACCEPTED = 'upsell.accepted',
  UPSELL_DECLINED = 'upsell.declined',

  JS_ERROR = 'frontend.js_error',

  ANALYSIS_CONVERSION_COMPLETED = 'analysis.conversion_completed',
}

type MQEventMetadata = {
  siteId?: string;
  visitorId?: string;
  orderId?: string;
  sessionId?: string;
  [key: string]: any;
};

export type MQEvent = {
  type: MQEventType;
  timestamp: Date;
  data: Record<string, any>;
  metadata?: MQEventMetadata;
};

export type PublishResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export interface IMQAdapter {
  readonly type: string;
  healthCheck(): Promise<boolean>;
  publish(topic: string, event: MQEvent): Promise<PublishResult>;
  publishBatch(topic: string, events: MQEvent[]): Promise<PublishResult[]>;
}
