import { describe, it, expect, vi } from "vitest";

const state = vi.hoisted(() => ({ authScope: [] as string[], writeAccess: true }));

vi.mock("@/composition/identity-deps", () => ({ resolveIdentityDeps: () => ({}) }));
vi.mock("@/composition/make-identity", () => ({
  makeIdentity: () => ({
    apiAuth: {
      authenticate: async (header: string | null) => {
        if (!header?.startsWith("Bearer ")) return null;
        const { PermissionSet } = await import("@/modules/shared-kernel/permission-set");
        const { toFeatureKey } = await import("@/modules/identity/domain/feature-key");
        return {
          kind: "apiClient",
          apiKeyId: "k1",
          tenantId: "default",
          writeAccess: state.writeAccess,
          permissions: PermissionSet.of(state.authScope.map(toFeatureKey)),
        };
      },
    },
  }),
}));
vi.mock("@/composition/order-fulfillment-deps", () => ({
  makeOrderDashboardQuery: () => ({
    list: async () => ({
      items: [
        {
          id: "o1",
          orderNumber: "1001",
          status: "PAID",
          saleRef: "sale-1",
          capturedTotalMinor: 2999,
          currencyCode: "USD",
          customerEmail: "buyer@example.com",
          customerName: "Buyer One",
          trackingNumber: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    }),
  }),
  buildOrderFulfillmentDeps: () => ({}),
}));
vi.mock("@/composition/make-order-fulfillment", () => ({ makeOrderFulfillment: () => ({}) }));
vi.mock("@/composition/analytics/make-stats", () => ({ loadStatsData: async () => ({}) }));

import { POST, GET, DELETE } from "./mcp";
import { allToolDefinitions } from "@/composition/mcp/tools";

const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  authorization: "Bearer sk_test",
};

function rpc(body: unknown, headers: Record<string, string> = MCP_HEADERS) {
  return {
    request: new Request("https://host.example/api/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    locals: {},
    url: new URL("https://host.example/api/mcp"),
    params: {},
  } as never;
}

const INIT = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  },
};

async function readJson(res: Response) {
  const text = await res.text();
  // Streamable HTTP may answer as SSE; unwrap the first data: frame when it does.
  if (res.headers.get("content-type")?.includes("text/event-stream")) {
    const line = text.split("\n").find((l) => l.startsWith("data:"));
    return JSON.parse(line!.slice(5).trim());
  }
  return JSON.parse(text);
}

describe("tool catalog", () => {
  it("registers exactly the 20 documented tools", () => {
    expect(allToolDefinitions().map((t) => t.name).sort()).toEqual(
      [
        "add_funnel_page",
        "create_funnel",
        "create_page",
        "deliver_order",
        "delete_funnel",
        "get_funnel",
        "get_page",
        "get_stats",
        "get_template",
        "list_funnels",
        "list_orders",
        "list_pages",
        "list_products",
        "list_templates",
        "remove_funnel_page",
        "replace_funnel_page",
        "set_funnel_step_slug",
        "update_funnel",
        "update_page",
        "upload_media",
      ].sort(),
    );
  });
});

describe("POST /api/mcp auth", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = (await POST(rpc(INIT, { "content-type": "application/json" }))) as Response;
    expect(res.status).toBe(401);
  });

  it("completes the initialize handshake with a valid key", async () => {
    state.authScope = ["ORDERS"];
    const res = (await POST(rpc(INIT))) as Response;
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.result.serverInfo.name).toBe("autonnel");
    expect(body.result.capabilities.tools).toBeDefined();
  });

  it("does not issue a session id in stateless mode", async () => {
    state.authScope = ["ORDERS"];
    const res = (await POST(rpc(INIT))) as Response;
    expect(res.headers.get("mcp-session-id")).toBeNull();
  });
});

describe("GET and DELETE /api/mcp", () => {
  it("rejects GET with 405 because stateless mode has no SSE stream", async () => {
    const res = (await GET({
      request: new Request("https://host.example/api/mcp", { headers: MCP_HEADERS }),
      locals: {},
      url: new URL("https://host.example/api/mcp"),
      params: {},
    } as never)) as Response;
    expect(res.status).toBe(405);
  });

  it("rejects DELETE with 405 because there is no session to end", async () => {
    const res = (await DELETE({
      request: new Request("https://host.example/api/mcp", { method: "DELETE", headers: MCP_HEADERS }),
      locals: {},
      url: new URL("https://host.example/api/mcp"),
      params: {},
    } as never)) as Response;
    expect(res.status).toBe(405);
  });
});

describe("POST /api/mcp tools/list and tools/call over the wire", () => {
  it("lists only the tools the ORDERS-scoped key is permitted to call", async () => {
    state.authScope = ["ORDERS"];
    const res = (await POST(rpc(INIT))) as Response;
    expect(res.status).toBe(200);

    const listRes = (await POST(
      rpc({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    )) as Response;
    expect(listRes.status).toBe(200);
    const listBody = await readJson(listRes);
    const names = (listBody.result.tools as { name: string }[]).map((t) => t.name).sort();
    expect(names).toEqual(["deliver_order", "list_orders"].sort());
  });

  it("calls list_orders and returns the JSON payload in result.content[0].text", async () => {
    state.authScope = ["ORDERS"];
    const initRes = (await POST(rpc(INIT))) as Response;
    expect(initRes.status).toBe(200);

    const callRes = (await POST(
      rpc({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "list_orders", arguments: {} },
      }),
    )) as Response;
    expect(callRes.status).toBe(200);
    const callBody = await readJson(callRes);
    const payload = JSON.parse(callBody.result.content[0].text);
    expect(payload.orders[0].orderNumber).toBe("1001");
    expect(payload.orders[0].total).toBe(29.99);
  });

  // The MCP SDK wraps its whole "tools/call" dispatch (schema validation, handler
  // execution, output validation) in one try/catch that turns any thrown error - including
  // our own ProtocolError from toMcpError() - into a successful JSON-RPC `result` shaped
  // {content, isError:true}. Only failures raised before that try block (name lookup) become
  // a real JSON-RPC `error` object. See mcp-DXXb3Vv3.mjs's tools/call handler.
  it("surfaces a validation failure inside a known tool as result.isError, not a JSON-RPC error", async () => {
    state.authScope = ["ORDERS"];
    const initRes = (await POST(rpc(INIT))) as Response;
    expect(initRes.status).toBe(200);

    // list_orders is .strict(); an unknown argument fails validation before the handler runs.
    const callRes = (await POST(
      rpc({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "list_orders", arguments: { bogus: true } },
      }),
    )) as Response;
    expect(callRes.status).toBe(200);
    const callBody = await readJson(callRes);

    expect(callBody.error).toBeUndefined();
    expect(callBody.result.isError).toBe(true);
    expect(callBody.result.content[0].text).toEqual(expect.stringContaining("list_orders"));
  });

  it("surfaces an unrecognized tool name as a genuine JSON-RPC error object", async () => {
    state.authScope = ["ORDERS"];
    const initRes = (await POST(rpc(INIT))) as Response;
    expect(initRes.status).toBe(200);

    const callRes = (await POST(
      rpc({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "does_not_exist", arguments: {} },
      }),
    )) as Response;
    expect(callRes.status).toBe(200);
    const callBody = await readJson(callRes);

    expect(callBody.result).toBeUndefined();
    expect(callBody.error).toBeDefined();
    expect(typeof callBody.error.code).toBe("number");
    expect(callBody.error.message).toEqual(expect.stringContaining("does_not_exist"));
  });
});
