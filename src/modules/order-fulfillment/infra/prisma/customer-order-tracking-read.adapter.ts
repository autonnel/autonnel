import type {
  CustomerOrderTrackingReadPort,
  TrackedOrderItemView,
  TrackedOrderView,
} from "../../application/customer-order-tracking-read-model";
import { TRACKABLE_STATUSES } from "../../application/customer-order-tracking-read-model";
import type { OrderRow } from "./order-mapper";

// tenantId is auto-injected by the Prisma tenant extension; the where-clause here is tenant-implicit.
interface OrderDelegate {
  findMany(args: unknown): Promise<Array<OrderRow & { createdAt?: Date | string }>>;
}
interface PrismaLike {
  order: OrderDelegate;
}

interface LineJson {
  externalRef: string;
  title: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export class PrismaCustomerOrderTrackingReadAdapter implements CustomerOrderTrackingReadPort {
  constructor(private readonly db: PrismaLike) {}

  async byEmailAndNumber(email: string, orderNumber: string): Promise<TrackedOrderView | null> {
    const rows = await this.db.order.findMany({
      where: { customerEmail: email, orderNumber, status: { in: TRACKABLE_STATUSES } },
      take: 1,
    });
    return rows[0] ? toTrackedOrder(rows[0]) : null;
  }
}

function toTrackedOrder(row: OrderRow & { createdAt?: Date | string }): TrackedOrderView {
  const lines = (row.lines as LineJson[] | null) ?? [];
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    createdAt: toIso(row.createdAt),
    capturedTotalMinor: row.capturedTotal,
    currencyCode: row.currencyCode,
    customerName: row.customerName ?? null,
    items: lines.map<TrackedOrderItemView>((l) => ({
      externalRef: l.externalRef,
      title: l.title,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
    })),
    trackingNumber: row.trackingNumber ?? null,
    trackingCarrier: row.trackingCarrier ?? null,
    trackingUrl: row.trackingUrl ?? null,
  };
}

function toIso(value: Date | string | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
