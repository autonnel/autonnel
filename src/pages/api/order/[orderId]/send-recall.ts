import { defineRoute, ApiError } from "@/lib/api/define-route";
import { makeRecall } from "@/composition/make-recall";
import { createRecallDepsForRequest } from "@/composition/make-recall-deps";
import { makeOrderDashboardQuery } from "@/composition/order-fulfillment-deps";

export const POST = defineRoute(
  "POST /api/order/:orderId/send-recall",
  { feature: "ORDERS" },
  async ({ params, locals }) => {
    const orderId = params.orderId!;
    const bundle = await makeOrderDashboardQuery(locals).detail(orderId);
    if (!bundle) throw new ApiError(404, "Order not found");

    const { order } = bundle;
    if (!order.hashedIdentity) throw new ApiError(409, "No checkout context for this order");

    const recall = makeRecall(await createRecallDepsForRequest(locals));
    await recall.detectAndEnroll.handle({
      checkoutRef: order.saleRef,
      sessionId: order.attribution?.sessionId ?? order.saleRef,
      funnelId: "",
      locale: order.checkoutLanguage ?? "en",
      cartValueMinor: order.capturedTotalMinor,
      contact: {
        hashedIdentity: order.hashedIdentity,
        normalizedEmail: order.contactChannel === "EMAIL" ? order.contactNormalized ?? undefined : undefined,
        normalizedPhone: order.contactChannel === "SMS" ? order.contactNormalized ?? undefined : undefined,
        consentedChannels: [order.contactChannel === "SMS" ? "sms" : "email"],
      },
      attributionParams: {},
    });

    return { success: true, enrolled: true };
  },
);
