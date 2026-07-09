export const EmailTemplateType = {
  ORDER_RECEIPT: 'ORDER_RECEIPT',
  ORDER_SHIPPED: 'ORDER_SHIPPED',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  ORDER_REFUNDED: 'ORDER_REFUNDED',
  RECALL_1: 'RECALL_1',
  RECALL_2: 'RECALL_2',
  RECALL_3: 'RECALL_3',
} as const;

export type EmailTemplateType = (typeof EmailTemplateType)[keyof typeof EmailTemplateType];
