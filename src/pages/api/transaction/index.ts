import { defineRoute } from "@/lib/api/define-route";
import { makeTransactionQuery } from "@/composition/make-payments";
import type { TransactionListFilters } from "@/modules/payments/application/transaction-query.service";

export const GET = defineRoute("GET /api/transaction", { feature: "TRANSACTIONS" }, async ({ query }) => {
  const page = Math.max(1, Number(query.get("page") ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, Number(query.get("limit") ?? "20") || 20));

  const filters: TransactionListFilters = {};
  const type = query.get("type");
  if (type === "CHARGE" || type === "REFUND") filters.type = type;
  const status = query.get("status");
  if (status) filters.status = status;
  const provider = query.get("provider");
  if (provider) filters.provider = provider;
  const search = query.get("search") ?? query.get("q");
  if (search) filters.search = search;
  const from = query.get("from") ?? query.get("dateFrom");
  if (from) filters.dateFrom = from;
  const to = query.get("to") ?? query.get("dateTo");
  if (to) filters.dateTo = to;

  const result = await makeTransactionQuery().list(filters, page, limit);
  return {
    transactions: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  };
});
