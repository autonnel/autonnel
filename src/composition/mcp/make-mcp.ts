import { McpServer } from "@modelcontextprotocol/server";
import { InProcessMcpServer } from "@/modules/platform/infra/registries/mcp-server";
import { InvokeMcpToolService, type McpAuthorizationPort } from "@/modules/platform/application/invoke-mcp-tool.service";
import { ForbiddenError } from "@/modules/identity/published/principal";
import { toFeatureKey } from "@/modules/identity/domain/feature-key";
import { requireWriteAccess } from "@/composition/external-auth";
import type { ApiClientPrincipal } from "@/modules/shared-kernel/principal";
import { toMcpError } from "./errors";
import { allToolDefinitions } from "./tools";

export const MCP_SERVER_NAME = "autonnel";
export const MCP_SERVER_VERSION = "1.0.0";

export interface BuiltMcpServer {
  server: McpServer;
  permittedToolNames: string[];
  callTool(name: string, args: unknown): Promise<{ content: { type: "text"; text: string }[] }>;
}

// Built per request: tenant id and principal live in AsyncLocalStorage, so a server instance
// reused across requests would close over one caller's tenant and leak it into the next.
export function makeMcpServer(input: { locals: unknown; principal: ApiClientPrincipal }): BuiltMcpServer {
  const { locals, principal } = input;

  // Checked against the principal passed in, not the ALS-resolved one: this factory is called
  // with an explicit principal before that principal is necessarily the ALS-current one (e.g.
  // in tests, and before Task 11's route enters runWithContext).
  const authz: McpAuthorizationPort = {
    requireFeature: (key) => {
      if (!principal.permissions.has(toFeatureKey(key))) throw new ForbiddenError(toFeatureKey(key));
    },
    requireWriteAccess: () => requireWriteAccess(principal),
  };

  const registry = new InProcessMcpServer();
  // tools/list is filtered to what this key is granted, so an ORDERS-only key is never shown
  // page-authoring tools it cannot call.
  const permitted = allToolDefinitions().filter((d) =>
    principal.permissions.has(toFeatureKey(d.requiredFeature)),
  );
  for (const def of permitted) {
    registry.registerTool(
      {
        name: def.name,
        title: def.title,
        description: def.description,
        requiredFeature: def.requiredFeature,
        writeAccess: def.writeAccess,
        inputSchema: def.inputSchema,
      },
      (parsed) => def.handler(parsed, { locals }),
    );
  }

  const invoker = new InvokeMcpToolService(registry, authz);

  async function callTool(name: string, args: unknown) {
    try {
      const out = await invoker.execute(name, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(out, null, 2) }] };
    } catch (err) {
      throw toMcpError(err);
    }
  }

  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION });
  for (const def of permitted) {
    server.registerTool(
      def.name,
      { title: def.title, description: def.description, inputSchema: def.inputSchema },
      (args: unknown) => callTool(def.name, args),
    );
  }

  return { server, permittedToolNames: permitted.map((d) => d.name), callTool };
}
