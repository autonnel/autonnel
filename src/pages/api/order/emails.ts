import { defineRoute } from "@/lib/api/define-route";
import { makeOrderEmailMonitor } from "@/composition/order-fulfillment-deps";

export const GET = defineRoute(
  "GET /api/order/emails",
  { feature: "ORDERS_EMAILS" },
  async ({ query, locals }) => {
    const page = Math.max(1, Number(query.get("page") ?? "1") || 1);
    const limit = Math.min(100, Math.max(1, Number(query.get("limit") ?? "20") || 20));
    return makeOrderEmailMonitor(locals).list({ page, limit });
  },
);
