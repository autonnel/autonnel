import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { InProcessMcpServer } from "../infra/registries/mcp-server";
import {
  InvokeMcpToolService,
  McpToolNotFoundError,
  McpToolInputError,
  type McpAuthorizationPort,
} from "./invoke-mcp-tool.service";

function authzSpy(overrides: Partial<McpAuthorizationPort> = {}): McpAuthorizationPort {
  return {
    requireFeature: vi.fn(),
    requireWriteAccess: vi.fn(),
    ...overrides,
  };
}

function serverWith(opts: { writeAccess?: boolean; invoke?: (input: unknown) => Promise<unknown> } = {}) {
  const server = new InProcessMcpServer();
  server.registerTool(
    {
      name: "update_page",
      title: "Update page",
      description: "d",
      requiredFeature: "PAGES",
      writeAccess: opts.writeAccess ?? true,
      inputSchema: z.object({ pageId: z.string().min(1), publish: z.boolean().optional() }),
    },
    opts.invoke ?? (async (input) => ({ echoed: input })),
  );
  return server;
}

describe("InvokeMcpToolService", () => {
  it("throws McpToolNotFoundError for an unregistered tool", async () => {
    const svc = new InvokeMcpToolService(new InProcessMcpServer(), authzSpy());
    await expect(svc.execute("nope", {})).rejects.toBeInstanceOf(McpToolNotFoundError);
  });

  it("checks the required feature before anything else", async () => {
    const denied = new Error("forbidden");
    const authz = authzSpy({
      requireFeature: vi.fn(() => {
        throw denied;
      }),
    });
    const svc = new InvokeMcpToolService(serverWith(), authz);
    // Input is invalid too; the feature error must win so an unauthorized caller
    // learns nothing about the schema.
    await expect(svc.execute("update_page", { pageId: "" })).rejects.toBe(denied);
    expect(authz.requireFeature).toHaveBeenCalledWith("PAGES");
    expect(authz.requireWriteAccess).not.toHaveBeenCalled();
  });

  it("requires write access only for write tools", async () => {
    const authz = authzSpy();
    await new InvokeMcpToolService(serverWith({ writeAccess: false }), authz).execute("update_page", {
      pageId: "p1",
    });
    expect(authz.requireWriteAccess).not.toHaveBeenCalled();

    const writeAuthz = authzSpy();
    await new InvokeMcpToolService(serverWith({ writeAccess: true }), writeAuthz).execute("update_page", {
      pageId: "p1",
    });
    expect(writeAuthz.requireWriteAccess).toHaveBeenCalledOnce();
  });

  it("propagates the write-access denial verbatim", async () => {
    const denied = new Error("write denied");
    const authz = authzSpy({
      requireWriteAccess: vi.fn(() => {
        throw denied;
      }),
    });
    const svc = new InvokeMcpToolService(serverWith(), authz);
    await expect(svc.execute("update_page", { pageId: "p1" })).rejects.toBe(denied);
  });

  it("throws McpToolInputError naming the failing field path", async () => {
    const svc = new InvokeMcpToolService(serverWith(), authzSpy());
    const err = await svc.execute("update_page", { pageId: "" }).catch((e) => e);
    expect(err).toBeInstanceOf(McpToolInputError);
    if (!(err instanceof McpToolInputError)) throw err;
    expect(err.issues).toEqual([expect.objectContaining({ path: "pageId" })]);
    expect(err.message).toContain("pageId");
  });

  it("reports a nested path with dot notation", async () => {
    const server = new InProcessMcpServer();
    server.registerTool(
      {
        name: "t",
        title: "t",
        description: "d",
        requiredFeature: "PAGES",
        writeAccess: false,
        inputSchema: z.object({ meta: z.object({ title: z.string() }) }),
      },
      async () => ({}),
    );
    const err = await new InvokeMcpToolService(server, authzSpy()).execute("t", { meta: {} }).catch((e) => e);
    if (!(err instanceof McpToolInputError)) throw err;
    expect(err.issues[0].path).toBe("meta.title");
  });

  it("passes the parsed value to the invoker and returns its result", async () => {
    const invoke = vi.fn(async (input: unknown) => ({ got: input }));
    const svc = new InvokeMcpToolService(serverWith({ invoke }), authzSpy());
    const out = await svc.execute("update_page", { pageId: "p1", publish: true, stray: "dropped" });
    expect(invoke).toHaveBeenCalledWith({ pageId: "p1", publish: true });
    expect(out).toEqual({ got: { pageId: "p1", publish: true } });
  });

  it("treats a missing arguments object as an empty object", async () => {
    const server = new InProcessMcpServer();
    server.registerTool(
      {
        name: "list_pages",
        title: "List pages",
        description: "d",
        requiredFeature: "PAGES",
        writeAccess: false,
        inputSchema: z.object({ page: z.number().optional() }),
      },
      async (input) => ({ input }),
    );
    const svc = new InvokeMcpToolService(server, authzSpy());
    await expect(svc.execute("list_pages", undefined)).resolves.toEqual({ input: {} });
  });
});
