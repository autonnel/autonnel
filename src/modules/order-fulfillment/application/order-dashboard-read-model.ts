export type OrderStatusKey =
  | "PENDING"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export interface OrderListFilters {
  status?: OrderStatusKey[];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface OrderListItem {
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

export interface OrderListPage {
  items: OrderListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrderLineView {
  externalRef: string;
  title: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface OrderRefundView {
  transactionId: string;
  amountMinor: number;
  currencyCode: string;
  status: string;
  reason: string | null;
  createdAt: string;
}

export interface OrderVisitView {
  url: string;
  kind: string;
  occurredAt: string;
}

export interface OrderEmailView {
  id: string;
  templateKey: string;
  recipient: string;
  subject: string | null;
  status: string;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
}

export interface OrderDetailView {
  id: string;
  orderNumber: string;
  status: string;
  saleRef: string;
  capturedTotalMinor: number;
  currencyCode: string;
  customerEmail: string;
  customerName: string | null;
  customerPhone: string | null;
  checkoutLanguage: string | null;
  lines: OrderLineView[];
  trackingCarrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  backendOrderRef: string | null;
  note: string | null;
  attribution: { firstSeenUrl?: string; sessionId?: string; visitorId?: string } | null;
  contactChannel: string | null;
  contactNormalized: string | null;
  hashedIdentity: string | null;
  address: Record<string, unknown> | null;
  refunds: OrderRefundView[];
  refundedMinor: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderReadPort {
  list(input: {
    filters: OrderListFilters;
    page: number;
    limit: number;
  }): Promise<OrderListPage>;
  detail(orderId: string): Promise<OrderDetailView | null>;
  forExport(filters: OrderListFilters): Promise<OrderListItem[]>;
}

export interface OrderVisitReadPort {
  bySession(sessionId: string, limit: number): Promise<{ visits: OrderVisitView[]; total: number }>;
}

export interface OrderEmailReadPort {
  // Dispatches linked via idempotencyKey prefix `order:<orderId>:<templateKey>`.
  byOrder(orderId: string): Promise<OrderEmailView[]>;
}

export interface OrderEmailMonitorPage {
  emails: OrderEmailView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrderEmailMonitorReadPort {
  list(input: { page: number; limit: number }): Promise<OrderEmailMonitorPage>;
}

export interface OrderTransactionReadPort {
  byParent(parentTransactionId: string): Promise<OrderRefundView[]>;
}
