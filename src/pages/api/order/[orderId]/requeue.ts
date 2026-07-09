import { defineRoute, ApiError } from "@/lib/api/define-route";
import { makeOrderFulfillment } from "@/composition/make-order-fulfillment";
import { buildOrderFulfillmentDeps, makeOrderDashboardQuery } from "@/composition/order-fulfillment-deps";
import { makePlatform } from "@/composition/make-platform";
import { registerStorefrontHandlers } from "@/composition/storefront-runtime";
import { getCurrentTenantId } from "@/lib/tenant/context";
import { IdempotencyKey } from "@/modules/shared-kernel/idempotency-key";

// "postbacks" re-enqueues the captured sale's commerce.handoff Job; the Job state machine
// owns retry/idempotency. "email" re-emits the order receipt via the lifecycle-email seam.
export const POST = defineRoute(
  "POST /api/order/:orderId/requeue",
  { feature: "ORDERS" },
  async ({ params, input, locals }) => {
    const orderId = params.orderId!;
    const order = await makeOrderDashboardQuery(locals).detail(orderId);
    if (!order) throw new ApiError(404, "Order not found");

    const requeueHandoff = input?.postbacks !== false;
    const requeueEmail = input?.email !== false;
    const results: {
      postbacks?: { success: boolean; error?: string };
      email?: { success: boolean; error?: string };
    } = {};

    if (requeueHandoff) {
      try {
        registerStorefrontHandlers();
        const saleRef = order.order.saleRef;
        const key = IdempotencyKey.derive(getCurrentTenantId(), saleRef);
        await makePlatform(locals as { cfContext?: { waitUntil(p: Promise<unknown>): void } }).enqueueJob.enqueue({
          kind: "commerce.handoff",
          idempotencyKey: key.value,
          payload: { saleRef },
          dispatch: "INLINE_WAIT_UNTIL",
          maxAttempts: 5,
        });
        results.postbacks = { success: true };
      } catch (err) {
        results.postbacks = { success: false, error: err instanceof Error ? err.message : "requeue failed" };
      }
    }

    if (requeueEmail) {
      try {
        const ctx = makeOrderFulfillment(buildOrderFulfillmentDeps(locals));
        await ctx.resendReceiptEmail.execute(orderId);
        results.email = { success: true };
      } catch (err) {
        results.email = { success: false, error: err instanceof Error ? err.message : "email failed" };
      }
    }

    return results;
  },
);
