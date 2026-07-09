import { defineRoute } from "@/lib/api/define-route";
import { makeOrderDashboardQuery } from "@/composition/order-fulfillment-deps";

export const GET = defineRoute(
  "GET /api/order/:orderId/visits",
  { feature: "ORDERS" },
  async ({ params, query, locals }) => {
    const limit = Number(query.get("limit") ?? "100") || 100;
    return makeOrderDashboardQuery(locals).visitsForOrder(params.orderId!, limit);
  },
);
