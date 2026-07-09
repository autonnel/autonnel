import type { APIRoute } from "astro";
import { withApiPrincipal } from "@/composition/external-auth";
import { makeCommerceGatewayReadSide } from "@/composition/make-commerce-gateway";
import { createLogger } from "@/lib/logger";

const logger = createLogger("ExternalProductsRoute");

export const GET: APIRoute = (context) =>
  withApiPrincipal(context, async () => {
    const term = context.url.searchParams.get("q") ?? "";
    const limit = Math.min(Number(context.url.searchParams.get("limit") ?? 50), 250);
    try {
      const port = await makeCommerceGatewayReadSide();
      const products = await port.searchCatalog(term, limit);
      return Response.json({ products });
    } catch (err) {
      logger.error("External products list failed", { error: err });
      return new Response(JSON.stringify({ error: "commerce_unavailable" }), { status: 503 });
    }
  });
