export interface TransactionListFilters {
  type?: "CHARGE" | "REFUND";
  status?: string;
  provider?: string;
  parentTransactionId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface TransactionListItem {
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

export interface TransactionListPage {
  items: TransactionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TransactionReadPort {
  list(input: {
    filters: TransactionListFilters;
    page: number;
    limit: number;
  }): Promise<TransactionListPage>;
  findById(id: string): Promise<TransactionListItem | null>;
}

export class TransactionQueryService {
  constructor(private readonly reader: TransactionReadPort) {}

  list(filters: TransactionListFilters, page: number, limit: number): Promise<TransactionListPage> {
    return this.reader.list({
      filters,
      page: Math.max(1, page),
      limit: clampLimit(limit),
    });
  }

  get(id: string): Promise<TransactionListItem | null> {
    return this.reader.findById(id);
  }

  byParent(parentTransactionId: string): Promise<TransactionListItem[]> {
    return this.reader
      .list({ filters: { parentTransactionId, type: "REFUND" }, page: 1, limit: 100 })
      .then((p) => p.items);
  }
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 20;
  return Math.min(100, Math.floor(limit));
}
