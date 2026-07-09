import { defineRoute, ApiError } from "@/lib/api/define-route";
import { makeOrderDashboardQuery } from "@/composition/order-fulfillment-deps";

export const GET = defineRoute(
  "GET /api/order/:orderId",
  { feature: "ORDERS" },
  async ({ params, locals }) => {
    const bundle = await makeOrderDashboardQuery(locals).detail(params.orderId!);
    if (!bundle) throw new ApiError(404, "Order not found");
    return bundle;
  },
);
