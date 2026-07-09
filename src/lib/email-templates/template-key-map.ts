import type { EmailTemplateType } from './types';

// Single source of truth bridging the editor-facing EmailTemplateType to the messaging
// store's templateKey (the key the send path resolves). Order keys match LifecycleTemplateKey
// in order-fulfillment; recall keys match the recall touch keys.
export const TYPE_TO_MESSAGING_KEY: Record<EmailTemplateType, string> = {
  ORDER_RECEIPT: 'order.receipt',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_REFUNDED: 'order.refunded',
  RECALL_1: 'recall.touch.1',
  RECALL_2: 'recall.touch.2',
  RECALL_3: 'recall.touch.3',
};

export const MESSAGING_KEY_TO_TYPE: Record<string, EmailTemplateType> = {
  ...(Object.fromEntries(
    Object.entries(TYPE_TO_MESSAGING_KEY).map(([type, key]) => [key, type as EmailTemplateType]),
  ) as Record<string, EmailTemplateType>),
  // Legacy single-touch recall key resolves to the first recall design.
  'recall.abandoned_checkout': 'RECALL_1',
};

// Core variables a real lifecycle send always populates. Declaring them required makes the
// renderer fail loudly (job error -> retry) instead of silently shipping a blank email when a
// regression drops the variables map. Only ever-present values are listed (orderNumber is always
// set; refundAmount is always formatted) so a legitimate send never trips the guard.
export const REQUIRED_CORE_VARS: Record<string, readonly string[]> = {
  'order.receipt': ['orderNumber'],
  'order.shipped': ['orderNumber'],
  'order.delivered': ['orderNumber'],
  'order.refunded': ['orderNumber', 'refundAmount'],
};

export function requiredCoreVars(messagingKey: string): readonly string[] {
  return REQUIRED_CORE_VARS[messagingKey] ?? [];
}

export function messagingKeyForType(type: EmailTemplateType): string {
  return TYPE_TO_MESSAGING_KEY[type];
}

export function typeForMessagingKey(key: string): EmailTemplateType | undefined {
  return MESSAGING_KEY_TO_TYPE[key];
}
