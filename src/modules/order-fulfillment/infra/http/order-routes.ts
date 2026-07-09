import type { OrderFulfillmentContext } from "@/composition/make-order-fulfillment";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function handleResync(ctx: OrderFulfillmentContext): Promise<Response> {
  const result = await ctx.syncFulfillmentStatus.sweep();
  return json(result, 200);
}

export async function handleExternalDeliver(
  ctx: OrderFulfillmentContext,
  orderId: string,
): Promise<Response> {
  const out = await ctx.markOrderDelivered.execute(orderId);
  if (out.state === "NOT_FOUND") return json({ error: "order_not_found" }, 404);
  return json(out, 200);
}
