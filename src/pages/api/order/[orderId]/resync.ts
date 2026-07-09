import { defineRoute } from "@/lib/api/define-route";
import { makeOrderFulfillment } from "@/composition/make-order-fulfillment";
import { buildOrderFulfillmentDeps } from "@/composition/order-fulfillment-deps";

export const POST = defineRoute(
  "POST /api/order/:orderId/resync",
  { feature: "ORDERS" },
  async ({ locals }) => {
    const ctx = makeOrderFulfillment(buildOrderFulfillmentDeps(locals));
    return ctx.syncFulfillmentStatus.sweep();
  },
);
