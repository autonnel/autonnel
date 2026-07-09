import type { APIRoute } from "astro";
import { authenticateExternalApi, requireWriteAccess, jsonError } from "@/lib/auth/externalApiAuth";
import { makeOrderFulfillment } from "@/composition/make-order-fulfillment";
import { buildOrderFulfillmentDeps } from "@/composition/order-fulfillment-deps";
import { handleExternalDeliver } from "@/modules/order-fulfillment/infra/http/order-routes";

export const POST: APIRoute = async (context) => {
  const auth = await authenticateExternalApi(context);
  if (auth instanceof Response) return auth;
  const writeCheck = requireWriteAccess(auth);
  if (writeCheck) return writeCheck;

  const orderId = context.params.orderId;
  if (!orderId) return jsonError("Missing orderId parameter", 400);

  const ctx = makeOrderFulfillment(buildOrderFulfillmentDeps(context.locals));
  return handleExternalDeliver(ctx, orderId);
};
