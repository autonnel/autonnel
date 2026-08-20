import type { APIRoute } from "astro";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { withApiPrincipal } from "@/composition/external-auth";
import { makeMcpServer } from "@/composition/mcp/make-mcp";
import { createLogger } from "@/lib/logger";

const logger = createLogger("McpRoute");

function methodNotAllowed(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. This endpoint is stateless: POST only." },
      id: null,
    }),
    { status: 405, headers: { "content-type": "application/json", allow: "POST" } },
  );
}

export const POST: APIRoute = (context) =>
  withApiPrincipal(context, async (principal) => {
    // Stateless: a fresh server + transport per request. tenantId and principal live in
    // AsyncLocalStorage, so a shared instance would leak one caller's tenant into the next.
    const { server } = makeMcpServer({ locals: context.locals, principal });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    transport.onerror = (error) => logger.error("MCP transport error", { error });
    await server.connect(transport);
    return transport.handleRequest(context.request);
  }) as Promise<Response>;

export const GET: APIRoute = () => methodNotAllowed();
export const DELETE: APIRoute = () => methodNotAllowed();
