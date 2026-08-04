import type { APIRoute } from "astro";
import { jsonError } from "@/lib/auth/externalApiAuth";
import { requireFeature } from "@/modules/identity/published/principal";
import { withApiPrincipal, requireWriteAccess } from "@/composition/external-auth";
import { makeOrderFulfillment } from "@/composition/make-order-fulfillment";
import { buildOrderFulfillmentDeps } from "@/composition/order-fulfillment-deps";
import { handleExternalDeliver } from "@/modules/order-fulfillment/infra/http/order-routes";

export const POST: APIRoute = (context) =>
  withApiPrincipal(context, async (principal) => {
    requireFeature("ORDERS");
    requireWriteAccess(principal);

    const orderId = context.params.orderId;
    if (!orderId) return jsonError("Missing orderId parameter", 400);

    const ctx = makeOrderFulfillment(buildOrderFulfillmentDeps(context.locals));
    return handleExternalDeliver(ctx, orderId);
  });
