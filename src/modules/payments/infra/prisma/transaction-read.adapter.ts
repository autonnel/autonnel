import type {
  TransactionReadPort,
  TransactionListFilters,
  TransactionListItem,
  TransactionListPage,
} from "../../application/transaction-query.service";

interface TransactionRow {
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
  createdAt: Date | string;
}
interface PrismaLike {
  transaction: {
    findMany(args: unknown): Promise<TransactionRow[]>;
    findUnique(args: { where: { id: string } }): Promise<TransactionRow | null>;
    count(args: unknown): Promise<number>;
  };
}

// tenantId is auto-injected by the Prisma extension; where-clauses are tenant-implicit.
export class PrismaTransactionReadAdapter implements TransactionReadPort {
  constructor(private readonly db: PrismaLike) {}

  async list(input: {
    filters: TransactionListFilters;
    page: number;
    limit: number;
  }): Promise<TransactionListPage> {
    const where = buildWhere(input.filters);
    const [total, rows] = await Promise.all([
      this.db.transaction.count({ where }),
      this.db.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
    ]);
    return {
      items: rows.map(toItem),
      total,
      page: input.page,
      limit: input.limit,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    };
  }

  async findById(id: string): Promise<TransactionListItem | null> {
    const row = await this.db.transaction.findUnique({ where: { id } });
    return row ? toItem(row) : null;
  }
}

function buildWhere(filters: TransactionListFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.provider) where.provider = filters.provider;
  if (filters.parentTransactionId) where.parentTransactionId = filters.parentTransactionId;
  if (filters.search) {
    where.OR = [
      { providerRefundRef: { contains: filters.search, mode: "insensitive" } },
      { id: { contains: filters.search, mode: "insensitive" } },
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

function toItem(row: TransactionRow): TransactionListItem {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    parentTransactionId: row.parentTransactionId,
    refundKind: row.refundKind,
    amountMinor: row.amountMinor,
    currencyCode: row.currencyCode,
    provider: row.provider,
    providerRefundRef: row.providerRefundRef,
    reason: row.reason,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
  };
}
