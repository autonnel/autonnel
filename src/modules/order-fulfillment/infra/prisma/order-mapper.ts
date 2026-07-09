import { Money } from "@/modules/shared-kernel/money";
import { Order } from "../../domain/order";
import type { OrderLifecycleState } from "../../domain/order-lifecycle-state";
import {
  OfferLineSnapshot,
  CustomerSnapshot,
  ContactSnapshot,
  RefundRecordRef,
  BackendOrderRef,
} from "../../domain/value-objects";
import type { AddressSnapshot } from "../../domain/value-objects";
import { TrackingInfo } from "../../domain/tracking-info";

export interface OrderRow {
  id: string;
  tenantId: string;
  orderNumber: string;
  saleRef: string;
  status: string;
  capturedTotal: number;
  currencyCode: string;
  customerEmail: string;
  customerName: string | null;
  customerPhone: string | null;
  checkoutLanguage: string | null;
  lines: unknown;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  refunds: unknown;
  backendOrderRef: string | null;
  attribution: unknown;
  note: string | null;
  contactChannel: string | null;
  contactNormalized: string | null;
  hashedIdentity: string | null;
  address: unknown;
}

interface LineJson {
  externalRef: string;
  title: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}
interface RefundJson {
  transactionId: string;
  amountMinor: number;
}

export function toPrisma(order: Order, tenantId: string): OrderRow {
  return {
    id: order.id,
    tenantId,
    orderNumber: order.orderNumber,
    saleRef: order.saleRef,
    status: order.state,
    capturedTotal: order.capturedTotal.amountMinor,
    currencyCode: order.capturedTotal.currencyCode,
    customerEmail: order.customer.email,
    customerName: order.customer.name ?? null,
    customerPhone: order.customer.phone ?? null,
    checkoutLanguage: order.checkoutLanguage ?? null,
    lines: order.lines.map<LineJson>((l) => ({
      externalRef: l.externalRef,
      title: l.title,
      quantity: l.quantity,
      unitPriceMinor: l.unitPrice.amountMinor,
      lineTotalMinor: l.lineTotal.amountMinor,
    })),
    trackingCarrier: order.tracking?.carrier ?? null,
    trackingNumber: order.tracking?.trackingNumber ?? null,
    trackingUrl: order.tracking?.url ?? null,
    refunds: order.refunds.map<RefundJson>((r) => ({
      transactionId: r.transactionId,
      amountMinor: r.amount.amountMinor,
    })),
    backendOrderRef: order.backendOrderRef?.value ?? null,
    attribution: order.attribution ?? null,
    note: order.note,
    contactChannel: order.contact?.channel ?? null,
    contactNormalized: order.contact?.normalized ?? null,
    hashedIdentity: order.contact?.hashedIdentity ?? null,
    address: order.contact?.address ?? null,
  };
}

export function toDomain(row: OrderRow): Order {
  const currency = row.currencyCode;
  return Order.rehydrate({
    id: row.id,
    orderNumber: row.orderNumber,
    saleRef: row.saleRef,
    capturedTotal: Money.of(row.capturedTotal, currency),
    lines: (row.lines as LineJson[]).map((l) =>
      OfferLineSnapshot.of({
        externalRef: l.externalRef,
        title: l.title,
        quantity: l.quantity,
        unitPrice: Money.of(l.unitPriceMinor, currency),
        lineTotal: Money.of(l.lineTotalMinor, currency),
      }),
    ),
    customer: CustomerSnapshot.of({
      email: row.customerEmail,
      name: row.customerName ?? undefined,
      phone: row.customerPhone ?? undefined,
    }),
    checkoutLanguage: row.checkoutLanguage ?? null,
    state: row.status as OrderLifecycleState,
    tracking:
      row.trackingNumber || row.trackingCarrier || row.trackingUrl
        ? TrackingInfo.of({
            carrier: row.trackingCarrier ?? undefined,
            trackingNumber: row.trackingNumber ?? undefined,
            url: row.trackingUrl ?? undefined,
          })
        : undefined,
    refunds: (row.refunds as RefundJson[]).map((r) =>
      RefundRecordRef.of({ transactionId: r.transactionId, amount: Money.of(r.amountMinor, currency) }),
    ),
    contact:
      row.contactChannel || row.contactNormalized || row.hashedIdentity || row.address
        ? ContactSnapshot.of({
            channel: row.contactChannel ?? undefined,
            normalized: row.contactNormalized ?? undefined,
            hashedIdentity: row.hashedIdentity ?? undefined,
            address: (row.address as AddressSnapshot | null) ?? undefined,
          })
        : undefined,
    backendOrderRef: row.backendOrderRef ? BackendOrderRef.of(row.backendOrderRef) : undefined,
    attribution: (row.attribution as Order["attribution"]) ?? undefined,
    note: row.note ?? null,
  });
}
