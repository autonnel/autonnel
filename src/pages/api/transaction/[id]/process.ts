import type { APIRoute } from "astro";

export const POST: APIRoute = async () =>
  new Response(
    JSON.stringify({ error: "Use POST /api/order/:orderId/refund to issue refunds." }),
    { status: 410, headers: { "content-type": "application/json" } },
  );
