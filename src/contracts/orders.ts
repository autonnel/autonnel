export interface OrderListItemDto {
  id: string;
  orderNumber: string;
  status: string;
  saleRef: string;
  capturedTotalMinor: number;
  currencyCode: string;
  customerEmail: string;
  customerName: string | null;
  trackingNumber: string | null;
  createdAt: string;
}

export interface OrderListDto {
  orders: OrderListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrderLineDto {
  externalRef: string;
  title: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface OrderRefundDto {
  transactionId: string;
  amountMinor: number;
  currencyCode: string;
  status: string;
  reason: string | null;
  createdAt: string;
}

export interface OrderEmailDto {
  id: string;
  templateKey: string;
  recipient: string;
  subject: string | null;
  status: string;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
}

export interface OrderVisitDto {
  url: string;
  kind: string;
  occurredAt: string;
}

export interface OrderDetailDto {
  id: string;
  orderNumber: string;
  status: string;
  saleRef: string;
  capturedTotalMinor: number;
  currencyCode: string;
  customerEmail: string;
  customerName: string | null;
  customerPhone: string | null;
  lines: OrderLineDto[];
  trackingCarrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  backendOrderRef: string | null;
  note: string | null;
  attribution: { firstSeenUrl?: string; sessionId?: string; visitorId?: string } | null;
  refunds: OrderRefundDto[];
  refundedMinor: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetailBundleDto {
  order: OrderDetailDto;
  emails: OrderEmailDto[];
  visits: OrderVisitDto[];
  visitsTotal: number;
}

export interface TransactionDto {
  id: string;
  type: string;
  status: string;
  parentTransactionId: string | null;
  refundKind: string | null;
  amountMinor: number;
  currencyCode: string;
  provider: string;
  providerRefundRef: string | null;
  reason: string | null;
  createdAt: string;
}

export interface TransactionListDto {
  transactions: TransactionDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type RefundKindInput = "full" | "fixed" | "percentage";

export interface OrdersContracts {
  "GET /api/order": { input: null; output: OrderListDto };
  "GET /api/order/:orderId": { input: null; output: OrderDetailBundleDto };

  "PUT /api/order/:orderId/note": {
    input: { note: string | null };
    output: { note: string | null };
  };
  "POST /api/order/:orderId/requeue": {
    input: { postbacks?: boolean; email?: boolean } | null;
    output: {
      postbacks?: { success: boolean; error?: string };
      email?: { success: boolean; error?: string };
    };
  };
  "POST /api/order/:orderId/send-recall": {
    input: { templateKey?: string } | null;
    output: { success: boolean; enrolled: boolean };
  };
  "POST /api/order/:orderId/resync": {
    input: null;
    output: { scanned: number; advanced: number };
  };
  "GET /api/order/:orderId/visits": {
    input: null;
    output: { visits: OrderVisitDto[]; total: number };
  };

  "POST /api/order/:orderId/refund": {
    input: {
      intentId: string;
      kind: RefundKindInput;
      fixedAmountMinor?: number;
      currencyCode?: string;
      percentage?: number;
      reason?: string;
      idempotencyKey?: string;
      chargeRef?: string;
    };
    output: { refundTransactionId: string; refundedAmountMinor: number };
  };

  "GET /api/order/emails": {
    input: null;
    output: { emails: OrderEmailDto[]; total: number; page: number; limit: number; totalPages: number };
  };

  "GET /api/transaction": { input: null; output: TransactionListDto };
  "GET /api/transaction/:id": { input: null; output: TransactionDto };
}
