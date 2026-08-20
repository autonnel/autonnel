import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const state = vi.hoisted(() => ({
  authScope: ["PAGES"] as string[],
  writeAccess: true,
  handler: vi.fn(async (input: unknown) => ({ ok: true, input })),
}));

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
vi.mock("./tools", () => ({
  allToolDefinitions: () => [
    {
      name: "update_page",
      title: "Update page",
      description: "d",
      requiredFeature: "PAGES",
      writeAccess: true,
      inputSchema: z.object({ pageId: z.string().min(1), name: z.string().optional() }),
      handler: state.handler,
    },
    {
      name: "list_pages",
      title: "List pages",
      description: "d",
      requiredFeature: "PAGES",
      writeAccess: false,
      inputSchema: z.object({ limit: z.number().int().optional() }),
      handler: async (input: unknown) => ({ read: true, input }),
    },
    {
      name: "list_orders",
      title: "List orders",
      description: "d",
      requiredFeature: "ORDERS",
      writeAccess: false,
      inputSchema: z
        .object({
          status: z.array(z.enum(["PAID", "SHIPPED"])).optional(),
          search: z.string().optional(),
          limit: z.number().int().optional(),
          active: z.boolean().optional(),
        })
        .strict(),
      handler: async (input: unknown) => ({ read: true, input }),
    },
    {
      name: "list_wrapped",
      title: "List with wrapped numeric field",
      description: "d",
      requiredFeature: "PAGES",
      writeAccess: false,
      // Exists solely to pin the unwrap chain through both .nullable() and .default() on the
      // way to a numeric leaf, isolated from other tests so its default value can't leak in.
      inputSchema: z.object({ page: z.number().int().nullable().default(1) }).strict(),
      handler: async (input: unknown) => ({ read: true, input }),
    },
  ],
}));

import { toolRoute } from "./rest-bridge";

function ctx(init: { method?: string; body?: unknown; query?: string; params?: Record<string, string>; auth?: boolean }) {
  const url = new URL(`https://host.example/api/v1.1/x${init.query ?? ""}`);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.auth !== false) headers.authorization = "Bearer sk_test";
  return {
    request: new Request(url, {
      method: init.method ?? "POST",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
    url,
    params: init.params ?? {},
    locals: {},
  } as never;
}

beforeEach(() => {
  state.authScope = ["PAGES"];
  state.writeAccess = true;
  vi.clearAllMocks();
});

describe("toolRoute", () => {
  it("returns 401 without a key", async () => {
    const res = (await toolRoute("update_page")(ctx({ body: { pageId: "p1" }, auth: false }))) as Response;
    expect(res.status).toBe(401);
  });

  it("returns 403 when the key lacks the feature", async () => {
    state.authScope = ["ORDERS"];
    const res = (await toolRoute("update_page")(ctx({ body: { pageId: "p1" } }))) as Response;
    expect(res.status).toBe(403);
  });

  it("returns 403 when the key lacks write access on a write tool", async () => {
    state.writeAccess = false;
    const res = (await toolRoute("update_page")(ctx({ body: { pageId: "p1" } }))) as Response;
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("write_access_denied");
  });

  it("allows a read tool on a read-only key", async () => {
    state.writeAccess = false;
    const res = (await toolRoute("list_pages")(ctx({ method: "GET", query: "?limit=5" }))) as Response;
    expect(res.status).toBe(200);
  });

  it("returns 400 with the zod issue path on invalid input", async () => {
    const res = (await toolRoute("update_page")(ctx({ body: { pageId: "" } }))) as Response;
    expect(res.status).toBe(400);
    const body = (await res.json()) as { issues: { path: string; message: string }[] };
    expect(body.issues).toEqual([expect.objectContaining({ path: "pageId" })]);
  });

  it("returns 400 on a malformed JSON body", async () => {
    const url = new URL("https://host.example/api/v1.1/x");
    const res = (await toolRoute("update_page")({
      request: new Request(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer sk_test" },
        body: "{not json",
      }),
      url,
      params: {},
      locals: {},
    } as never)) as Response;
    expect(res.status).toBe(400);
  });

  it("merges route params over the body so a path id always wins", async () => {
    await toolRoute("update_page")(ctx({ body: { pageId: "from-body" }, params: { pageId: "from-path" } }));
    expect(state.handler).toHaveBeenCalledWith({ pageId: "from-path" }, { locals: {} });
  });

  it("reads a GET tool's arguments from the query string with numeric coercion", async () => {
    const res = (await toolRoute("list_pages")(ctx({ method: "GET", query: "?limit=25" }))) as Response;
    expect(await res.json()).toEqual({ read: true, input: { limit: 25 } });
  });

  it("does not coerce a string field whose value is all digits, e.g. an order-number search", async () => {
    state.authScope = ["ORDERS"];
    const res = (await toolRoute("list_orders")(
      ctx({ method: "GET", query: "?search=20260227001" }),
    )) as Response;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ read: true, input: { search: "20260227001" } });
  });

  it("wraps a single repeated array-field value in an array", async () => {
    state.authScope = ["ORDERS"];
    const res = (await toolRoute("list_orders")(ctx({ method: "GET", query: "?status=PAID" }))) as Response;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ read: true, input: { status: ["PAID"] } });
  });

  it("collects every repeated array-field value in order", async () => {
    state.authScope = ["ORDERS"];
    const res = (await toolRoute("list_orders")(
      ctx({ method: "GET", query: "?status=PAID&status=SHIPPED" }),
    )) as Response;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ read: true, input: { status: ["PAID", "SHIPPED"] } });
  });

  it("still coerces a number field so numeric filters keep working", async () => {
    state.authScope = ["ORDERS"];
    const res = (await toolRoute("list_orders")(ctx({ method: "GET", query: "?limit=25" }))) as Response;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ read: true, input: { limit: 25 } });
  });

  it("still coerces a boolean field", async () => {
    state.authScope = ["ORDERS"];
    const res = (await toolRoute("list_orders")(ctx({ method: "GET", query: "?active=true" }))) as Response;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ read: true, input: { active: true } });
  });

  it("coerces a numeric field wrapped in both .nullable() and .default()", async () => {
    const res = (await toolRoute("list_wrapped")(ctx({ method: "GET", query: "?page=3" }))) as Response;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ read: true, input: { page: 3 } });
  });

  it("honours a custom success status", async () => {
    const res = (await toolRoute("update_page", { status: 201 })(
      ctx({ body: { pageId: "p1" } }),
    )) as Response;
    expect(res.status).toBe(201);
  });

  it("maps a domain error to its own status code", async () => {
    const { PageDashboardError } = await import("@/modules/authoring/application/page-dashboard-service");
    state.handler.mockRejectedValue(new PageDashboardError(404, "Page not found"));
    const res = (await toolRoute("update_page")(ctx({ body: { pageId: "p1" } }))) as Response;
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Page not found");
  });

  it("maps unconfigured storage to 412 instead of a generic 500", async () => {
    const { StorageNotConfiguredError } = await import("@/lib/s3");
    state.handler.mockRejectedValue(new StorageNotConfiguredError());
    const res = (await toolRoute("update_page")(ctx({ body: { pageId: "p1" } }))) as Response;
    expect(res.status).toBe(412);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe("STORAGE_NOT_CONFIGURED");
    expect(body.error).toMatch(/Settings/);
  });

  it("returns 500 without leaking an unmapped error message", async () => {
    state.handler.mockRejectedValue(new Error("postgres://user:pw@host/db"));
    const res = (await toolRoute("update_page")(ctx({ body: { pageId: "p1" } }))) as Response;
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("postgres://");
  });

  it("throws at construction for an unknown tool name so a typo fails at boot", () => {
    expect(() => toolRoute("nope")).toThrow(/nope/);
  });
});
