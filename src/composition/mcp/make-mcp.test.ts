import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { PermissionSet } from "@/modules/shared-kernel/permission-set";
import { toFeatureKey } from "@/modules/identity/domain/feature-key";

const state = vi.hoisted(() => ({
  handler: vi.fn(async (input: unknown) => ({ echoed: input })),
}));

vi.mock("./tools/pages", () => ({
  pageTools: () => [
    {
      name: "get_page",
      title: "Get page",
      description: "Fetch a single page's full content and metadata by its id.",
      requiredFeature: "PAGES",
      writeAccess: false,
      inputSchema: z.object({ pageId: z.string().min(1) }),
      handler: state.handler,
    },
  ],
}));
vi.mock("./tools/templates", () => ({ pageTemplateTools: () => [] }));
vi.mock("./tools/funnels", () => ({ funnelTools: () => [] }));
vi.mock("./tools/funnel-steps", () => ({ funnelStepTools: () => [] }));
vi.mock("./tools/catalog", () => ({ catalogTools: () => [] }));
vi.mock("./tools/reporting", () => ({
  reportingTools: () => [
    {
      name: "list_orders",
      title: "List orders",
      description: "List orders for the current tenant with optional status filters.",
      requiredFeature: "ORDERS",
      writeAccess: false,
      inputSchema: z.object({}),
      handler: async () => ({ orders: [] }),
    },
    {
      name: "deliver_order",
      title: "Deliver",
      description: "Mark an order as delivered and trigger the delivery email.",
      requiredFeature: "ORDERS",
      writeAccess: true,
      inputSchema: z.object({ orderId: z.string().min(1) }),
      handler: async () => ({ state: "DELIVERED" }),
    },
  ],
}));

import { allToolDefinitions } from "./tools";
import { makeMcpServer } from "./make-mcp";

function principal(features: string[], writeAccess = true) {
  return {
    kind: "apiClient" as const,
    apiKeyId: "k1",
    tenantId: "default",
    writeAccess,
    permissions: PermissionSet.of(features.map(toFeatureKey)),
  };
}

describe("allToolDefinitions", () => {
  it("has unique tool names", () => {
    const names = allToolDefinitions().map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every tool a title, a description and a required feature", () => {
    for (const t of allToolDefinitions()) {
      expect(t.title, t.name).toBeTruthy();
      expect(t.description.length, t.name).toBeGreaterThan(20);
      expect(t.requiredFeature, t.name).toBeTruthy();
      expect(typeof t.writeAccess, t.name).toBe("boolean");
    }
  });
});

describe("makeMcpServer", () => {
  it("exposes the permitted tool names for the calling key", () => {
    expect(makeMcpServer({ locals: {}, principal: principal(["ORDERS"]) }).permittedToolNames.sort()).toEqual([
      "deliver_order",
      "list_orders",
    ]);
    expect(makeMcpServer({ locals: {}, principal: principal(["PAGES"]) }).permittedToolNames).toEqual([
      "get_page",
    ]);
    expect(makeMcpServer({ locals: {}, principal: principal([]) }).permittedToolNames).toEqual([]);
  });

  it("invokes the underlying handler with the parsed input", async () => {
    state.handler.mockClear();
    const built = makeMcpServer({ locals: { marker: 1 }, principal: principal(["PAGES"]) });
    const result: any = await built.callTool("get_page", { pageId: "p1" });
    expect(state.handler).toHaveBeenCalledWith({ pageId: "p1" }, { locals: { marker: 1 } });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ echoed: { pageId: "p1" } });
  });

  it("maps a write-tool call on a read-only key to an MCP error", async () => {
    const built = makeMcpServer({ locals: {}, principal: principal(["ORDERS"], false) });
    await expect(built.callTool("deliver_order", { orderId: "o1" })).rejects.toThrow(/write access/i);
  });

  it("maps invalid arguments to an error naming the field", async () => {
    const built = makeMcpServer({ locals: {}, principal: principal(["PAGES"]) });
    await expect(built.callTool("get_page", { pageId: "" })).rejects.toThrow(/pageId/);
  });

  it("maps an unknown tool name to an error", async () => {
    const built = makeMcpServer({ locals: {}, principal: principal(["PAGES"]) });
    await expect(built.callTool("nope", {})).rejects.toThrow(/nope/i);
  });
});
