import type {
  OrderReadPort,
  OrderListFilters,
  OrderListItem,
  OrderListPage,
  OrderDetailView,
  OrderLineView,
  OrderRefundView,
} from "../../application/order-dashboard-read-model";
import type { OrderRow } from "./order-mapper";

// tenantId is auto-injected by the Prisma extension; where-clauses here are tenant-implicit.
interface OrderDelegate {
  findMany(args: unknown): Promise<OrderRow[]>;
  findUnique(args: { where: { id: string } }): Promise<OrderRow | null>;
  count(args: unknown): Promise<number>;
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
interface RefundJson {
  transactionId: string;
  amountMinor: number;
}

const EXPORT_CAP = 10000;

export class PrismaOrderReadAdapter implements OrderReadPort {
  constructor(private readonly db: PrismaLike) {}

  async list(input: {
    filters: OrderListFilters;
    page: number;
    limit: number;
  }): Promise<OrderListPage> {
    const where = buildWhere(input.filters);
    const [total, rows] = await Promise.all([
      this.db.order.count({ where }),
      this.db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
    ]);
    return {
      items: rows.map(toListItem),
      total,
      page: input.page,
      limit: input.limit,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    };
  }

  async forExport(filters: OrderListFilters): Promise<OrderListItem[]> {
    const rows = await this.db.order.findMany({
      where: buildWhere(filters),
      orderBy: { createdAt: "desc" },
      take: EXPORT_CAP,
    });
    return rows.map(toListItem);
  }

  async detail(orderId: string): Promise<OrderDetailView | null> {
    const row = await this.db.order.findUnique({ where: { id: orderId } });
    return row ? toDetail(row) : null;
  }
}

function buildWhere(filters: OrderListFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.status && filters.status.length > 0) where.status = { in: filters.status };
  if (filters.search) {
    where.OR = [
      { orderNumber: { contains: filters.search, mode: "insensitive" } },
      { customerEmail: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  const createdAt: Record<string, Date> = {};
  if (filters.dateFrom) {
    const d = new Date(filters.dateFrom);
    if (!Number.isNaN(d.getTime())) createdAt.gte = d;
  }
  if (filters.dateTo) {
    const d = new Date(filters.dateTo);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      createdAt.lte = d;
    }
  }
  if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;
  return where;
}

function toListItem(row: OrderRow & { createdAt?: Date | string }): OrderListItem {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    saleRef: row.saleRef,
    capturedTotalMinor: row.capturedTotal,
    currencyCode: row.currencyCode,
    customerEmail: row.customerEmail,
    customerName: row.customerName ?? null,
    trackingNumber: row.trackingNumber ?? null,
    createdAt: toIso(row.createdAt),
  };
}

function toDetail(
  row: OrderRow & { createdAt?: Date | string; updatedAt?: Date | string },
): OrderDetailView {
  const lines = (row.lines as LineJson[] | null) ?? [];
  const refunds = (row.refunds as RefundJson[] | null) ?? [];
  const refundViews: OrderRefundView[] = refunds.map((r) => ({
    transactionId: r.transactionId,
    amountMinor: r.amountMinor,
    currencyCode: row.currencyCode,
    status: "COMPLETED",
    reason: null,
    createdAt: toIso(row.createdAt),
  }));
  const refundedMinor = refunds.reduce((acc, r) => acc + (r.amountMinor ?? 0), 0);
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    saleRef: row.saleRef,
    capturedTotalMinor: row.capturedTotal,
    currencyCode: row.currencyCode,
    customerEmail: row.customerEmail,
    customerName: row.customerName ?? null,
    customerPhone: row.customerPhone ?? null,
    checkoutLanguage: row.checkoutLanguage ?? null,
    lines: lines.map<OrderLineView>((l) => ({
      externalRef: l.externalRef,
      title: l.title,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
      lineTotalMinor: l.lineTotalMinor,
    })),
    trackingCarrier: row.trackingCarrier ?? null,
    trackingNumber: row.trackingNumber ?? null,
    trackingUrl: row.trackingUrl ?? null,
    backendOrderRef: row.backendOrderRef ?? null,
    note: row.note ?? null,
    attribution: (row.attribution as OrderDetailView["attribution"]) ?? null,
    contactChannel: row.contactChannel ?? null,
    contactNormalized: row.contactNormalized ?? null,
    hashedIdentity: row.hashedIdentity ?? null,
    address: (row.address as Record<string, unknown> | null) ?? null,
    refunds: refundViews,
    refundedMinor,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function toIso(value: Date | string | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
