import { defineRoute, ApiError } from "@/lib/api/define-route";
import { makeOrderFulfillment } from "@/composition/make-order-fulfillment";
import { buildOrderFulfillmentDeps } from "@/composition/order-fulfillment-deps";

export const PUT = defineRoute(
  "PUT /api/order/:orderId/note",
  { feature: "ORDERS" },
  async ({ params, input, locals }) => {
    const ctx = makeOrderFulfillment(buildOrderFulfillmentDeps(locals));
    const out = await ctx.setOrderNote.execute(params.orderId!, input?.note ?? null);
    if (out.state === "NOT_FOUND") throw new ApiError(404, "Order not found");
    return { note: out.note };
  },
);
