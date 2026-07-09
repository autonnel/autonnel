import { defineRoute } from "@/lib/api/define-route";
import { makeOrderDashboardQuery } from "@/composition/order-fulfillment-deps";
import type { OrderListFilters, OrderStatusKey } from "@/modules/order-fulfillment/application/order-dashboard-read-model";

const STATUSES: OrderStatusKey[] = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
];

export const GET = defineRoute("GET /api/order", { feature: "ORDERS" }, async ({ query, locals }) => {
  const page = Math.max(1, Number(query.get("page") ?? "1") || 1);
  const limit = Number(query.get("limit") ?? "30");

  const filters: OrderListFilters = {};
  const status = query.getAll("status").filter((s): s is OrderStatusKey => STATUSES.includes(s as OrderStatusKey));
  if (status.length > 0) filters.status = status;
  const search = query.get("search") ?? query.get("q");
  if (search) filters.search = search;
  const from = query.get("from") ?? query.get("dateFrom");
  if (from) filters.dateFrom = from;
  const to = query.get("to") ?? query.get("dateTo");
  if (to) filters.dateTo = to;

  const result = await makeOrderDashboardQuery(locals).list(filters, page, limit);
  return {
    orders: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  };
});
