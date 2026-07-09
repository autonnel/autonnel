import type { APIRoute } from "astro";
import { requireFeature, ForbiddenError } from "@/modules/identity/application/principal-resolution";
import { toFeatureKey } from "@/modules/identity/domain/feature-key";
import { makeOrderDashboardQuery } from "@/composition/order-fulfillment-deps";
import type {
  OrderListFilters,
  OrderStatusKey,
} from "@/modules/order-fulfillment/application/order-dashboard-read-model";

const ORDERS = toFeatureKey("ORDERS");
const STATUSES: OrderStatusKey[] = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
];
const BOM = "﻿";
const HEADERS = ["Created At", "Order #", "Status", "Customer", "Amount", "Currency", "Tracking #"];

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    requireFeature(ORDERS);
  } catch (err) {
    if (err instanceof ForbiddenError)
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    throw err;
  }

  const sp = url.searchParams;
  const filters: OrderListFilters = {};
  const status = sp.getAll("status").filter((s): s is OrderStatusKey => STATUSES.includes(s as OrderStatusKey));
  if (status.length > 0) filters.status = status;
  const search = sp.get("search") ?? sp.get("q");
  if (search) filters.search = search;
  const from = sp.get("from") ?? sp.get("dateFrom");
  if (from) filters.dateFrom = from;
  const to = sp.get("to") ?? sp.get("dateTo");
  if (to) filters.dateTo = to;

  const items = await makeOrderDashboardQuery(locals).forExport(filters);
  const rows = items.map((o) =>
    [
      o.createdAt.replace("T", " ").replace(/\.\d+Z$/, ""),
      o.orderNumber,
      o.status,
      o.customerName ? `${o.customerName} <${o.customerEmail}>` : o.customerEmail,
      (o.capturedTotalMinor / 100).toFixed(2),
      o.currencyCode,
      o.trackingNumber ?? "",
    ].map(csvCell).join(","),
  );
  const csv = BOM + [HEADERS.join(","), ...rows].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="orders_export.csv"`,
    },
  });
};
