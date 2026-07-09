import type {
  OrderEmailReadPort,
  OrderEmailMonitorReadPort,
  OrderEmailMonitorPage,
  OrderEmailView,
} from "../../application/order-dashboard-read-model";

interface DispatchRow {
  id: string;
  templateKey: string;
  recipient: string;
  renderedSubject: string | null;
  status: string;
  attemptCount: number;
  lastError: string | null;
  createdAt: Date | string;
}
interface PrismaLike {
  dispatch: {
    findMany(args: unknown): Promise<DispatchRow[]>;
    count(args: unknown): Promise<number>;
  };
}

// Lifecycle emails are enqueued by EmitLifecycleEmailService with idempotencyKey
// `order:<orderId>:<templateKey>`; the order detail/emails monitor reads those Dispatch
// rows back. We match on the orderId prefix (the saleRef is not on Dispatch).
export class PrismaOrderEmailReadAdapter
  implements OrderEmailReadPort, OrderEmailMonitorReadPort
{
  constructor(private readonly db: PrismaLike) {}

  async byOrder(orderIdOrSaleRef: string): Promise<OrderEmailView[]> {
    const rows = await this.db.dispatch.findMany({
      where: { idempotencyKey: { startsWith: `order:${orderIdOrSaleRef}:` } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map(toView);
  }

  async list(input: { page: number; limit: number }): Promise<OrderEmailMonitorPage> {
    const where = { idempotencyKey: { startsWith: "order:" } };
    const [total, rows] = await Promise.all([
      this.db.dispatch.count({ where }),
      this.db.dispatch.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
    ]);
    return {
      emails: rows.map(toView),
      total,
      page: input.page,
      limit: input.limit,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    };
  }
}

function toView(row: DispatchRow): OrderEmailView {
  return {
    id: row.id,
    templateKey: row.templateKey,
    recipient: row.recipient,
    subject: row.renderedSubject,
    status: row.status,
    attemptCount: row.attemptCount,
    lastError: row.lastError,
    createdAt: toIso(row.createdAt),
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
