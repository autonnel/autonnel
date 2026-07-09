import type { Order } from "../domain/order";
import type { FulfillmentStatus } from "../domain/fulfillment-status";
import type { TrackingInfo } from "../domain/tracking-info";
import type { OrderDomainEvent } from "../domain/events";
import type { SaleRef } from "../domain/value-objects";

export interface OrderCursor {
  updatedAt: Date;
  id: string;
}

export interface PaidOrdersPage {
  orders: Order[];
  nextCursor: OrderCursor | null;
}

export interface OrderRepositoryPort {
  findBySaleRef(saleRef: SaleRef): Promise<Order | null>;
  findById(orderId: string): Promise<Order | null>;
  findPaidWithBackendRef(limit: number, after?: OrderCursor): Promise<PaidOrdersPage>;
  save(order: Order): Promise<void>;
}

export interface BackendFulfillmentResult {
  status: FulfillmentStatus;
  tracking: TrackingInfo | undefined;
}

export interface BackendFulfillmentReaderPort {
  readFulfillment(backendOrderRef: string): Promise<BackendFulfillmentResult>;
}

export type LifecycleTemplateKey =
  | "order.receipt"
  | "order.shipped"
  | "order.delivered"
  | "order.refunded";

export interface SendNotificationInput {
  channel: "EMAIL";
  templateKey: LifecycleTemplateKey;
  recipient: string;
  mergeVariables: Record<string, unknown>;
  idempotencyKey: string;
  locale?: string;
}

export interface MessagingPort {
  send(input: SendNotificationInput): Promise<void>;
}

export interface BrandingInfo {
  storeName: string;
  storeUrl: string;
  storeEmail: string;
  storeLogo: string;
  timeZone: string;
}

export interface BrandingInfoPort {
  load(): Promise<BrandingInfo>;
}

export interface JobSchedulerPort {
  register(kind: string, handler: () => Promise<void>): void;
}

export interface DomainEventPublisherPort {
  publishAll(events: OrderDomainEvent[]): Promise<void>;
}

export interface OrderView {
  id: string;
  orderNumber: string;
  saleRef: SaleRef;
  state: string;
  capturedTotalMinor: number;
  currencyCode: string;
  trackingNumber?: string;
  customerEmail: string;
}

export interface OrderQueryPort {
  list(input: { limit: number; offset: number }): Promise<OrderView[]>;
  get(orderId: string): Promise<OrderView | null>;
}

export interface OrderDashboardPort {
  resync(orderId: string): Promise<{ changed: boolean; state: string }>;
  markDelivered(orderId: string): Promise<{ changed: boolean; state: string }>;
}

export interface FulfillmentCronPort {
  sweep(): Promise<{ scanned: number; advanced: number }>;
}
