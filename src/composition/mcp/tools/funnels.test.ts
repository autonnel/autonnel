import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  funnels: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  createWithDefaults: vi.fn(),
  db: { funnel: { findUnique: vi.fn(), findMany: vi.fn() }, page: { findMany: vi.fn() } },
}));

vi.mock("@/composition/make-funnel-dashboard", () => ({
  makeFunnelDashboard: () => ({ funnels: state.funnels }),
}));
vi.mock("@/composition/create-funnel-with-defaults", () => ({
  createFunnelWithDefaults: state.createWithDefaults,
}));
vi.mock("@/composition/authoring-runtime", () => ({
  authoringDepsFromLocals: () => ({ db: state.db }),
}));

import { funnelTools } from "./funnels";

const ctx = { locals: {} };
const byName = (name: string) => {
  const tool = funnelTools().find((t) => t.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool;
};

beforeEach(() => vi.clearAllMocks());

describe("funnelTools descriptors", () => {
  it("exposes the five funnel tools", () => {
    expect(funnelTools().map((t) => t.name).sort()).toEqual([
      "create_funnel",
      "delete_funnel",
      "get_funnel",
      "list_funnels",
      "update_funnel",
    ]);
  });

  it("marks the three mutations as write tools and requires FUNNELS throughout", () => {
    expect(funnelTools().filter((t) => t.writeAccess).map((t) => t.name).sort()).toEqual([
      "create_funnel",
      "delete_funnel",
      "update_funnel",
    ]);
    expect(funnelTools().every((t) => t.requiredFeature === "FUNNELS")).toBe(true);
  });
});

describe("list_funnels", () => {
  it("returns summaries with a step count and paginates in memory", async () => {
    state.funnels.list.mockResolvedValue([
      { id: "f1", name: "A", description: null, createdAt: new Date(0), updatedAt: new Date(0) },
      { id: "f2", name: "B", description: "d", createdAt: new Date(0), updatedAt: new Date(0) },
    ]);
    // Batched: one findMany for the whole page's steps, not one findUnique per funnel.
    state.db.funnel.findMany.mockResolvedValue([{ id: "f1", steps: [{ stepSlug: "lp", pageId: "p1" }] }]);
    const out: any = await byName("list_funnels").handler({ page: 1, limit: 1 }, ctx);
    expect(state.db.funnel.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["f1"] } },
      select: { id: true, steps: true },
    });
    expect(state.db.funnel.findUnique).not.toHaveBeenCalled();
    expect(out.funnels).toHaveLength(1);
    expect(out.funnels[0]).toMatchObject({ id: "f1", name: "A", stepCount: 1 });
    expect(out.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
  });

  it("defaults a funnel's step count to 0 when its steps row is missing from the batch", async () => {
    state.funnels.list.mockResolvedValue([
      { id: "f1", name: "A", description: null, createdAt: new Date(0), updatedAt: new Date(0) },
    ]);
    state.db.funnel.findMany.mockResolvedValue([]);
    const out: any = await byName("list_funnels").handler({}, ctx);
    expect(out.funnels[0]).toMatchObject({ id: "f1", stepCount: 0 });
  });
});

describe("get_funnel", () => {
  it("returns steps in array order with the referenced page's own type", async () => {
    state.funnels.get.mockResolvedValue({
      id: "f1", name: "A", description: null, createdAt: new Date(0), updatedAt: new Date(0),
    });
    state.db.funnel.findUnique.mockResolvedValue({
      id: "f1",
      steps: [
        { stepSlug: "lp", pageId: "p1" },
        { stepSlug: "co", pageId: "p2" },
      ],
    });
    state.db.page.findMany.mockResolvedValue([
      { id: "p2", slug: "checkout", name: "Checkout", type: "checkout", status: "PUBLISHED" },
      { id: "p1", slug: "lp", name: "LP", type: "custom", status: "PUBLISHED" },
    ]);
    const out: any = await byName("get_funnel").handler({ funnelId: "f1" }, ctx);
    expect(out.steps.map((s: any) => s.stepSlug)).toEqual(["lp", "co"]);
    expect(out.steps[0].page).toMatchObject({ id: "p1", type: "custom" });
    expect(out.steps[1].page).toMatchObject({ id: "p2", type: "checkout" });
    expect(out.steps[0]).not.toHaveProperty("order");
    expect(out.steps[0]).not.toHaveProperty("pageType");
  });

  it("keeps a step whose page was deleted, with page null", async () => {
    state.funnels.get.mockResolvedValue({
      id: "f1", name: "A", description: null, createdAt: new Date(0), updatedAt: new Date(0),
    });
    state.db.funnel.findUnique.mockResolvedValue({
      id: "f1", steps: [{ stepSlug: "gone", pageId: "dead" }],
    });
    state.db.page.findMany.mockResolvedValue([]);
    const out: any = await byName("get_funnel").handler({ funnelId: "f1" }, ctx);
    expect(out.steps).toEqual([{ stepSlug: "gone", pageId: "dead", page: null }]);
  });

  it("reports the entry step slug used for /n/{funnelId}/{stepSlug}", async () => {
    state.funnels.get.mockResolvedValue({
      id: "f1", name: "A", description: null, createdAt: new Date(0), updatedAt: new Date(0),
    });
    state.db.funnel.findUnique.mockResolvedValue({
      id: "f1", steps: [{ stepSlug: "lp", pageId: "p1" }],
    });
    state.db.page.findMany.mockResolvedValue([
      { id: "p1", slug: "lp", name: "LP", type: "custom", status: "PUBLISHED" },
    ]);
    const out: any = await byName("get_funnel").handler({ funnelId: "f1" }, ctx);
    expect(out.entryStepSlug).toBe("lp");
  });
});

describe("create_funnel", () => {
  it("goes through createFunnelWithDefaults so thankyou/error steps get added", async () => {
    state.createWithDefaults.mockResolvedValue({
      id: "f9", name: "New", description: null, createdAt: new Date(0), updatedAt: new Date(0),
    });
    const out: any = await byName("create_funnel").handler({ name: "New" }, ctx);
    expect(state.createWithDefaults).toHaveBeenCalledWith({
      name: "New",
      description: undefined,
      locals: ctx.locals,
    });
    expect(out.id).toBe("f9");
  });
});

describe("update_funnel", () => {
  it("passes only the provided fields", async () => {
    state.funnels.update.mockResolvedValue({
      id: "f1", name: "Renamed", description: null, createdAt: new Date(0), updatedAt: new Date(0),
    });
    await byName("update_funnel").handler({ funnelId: "f1", name: "Renamed" }, ctx);
    expect(state.funnels.update).toHaveBeenCalledWith("f1", { name: "Renamed" });
  });
});

describe("delete_funnel", () => {
  it("calls remove, not delete", async () => {
    state.funnels.remove.mockResolvedValue(undefined);
    const out: any = await byName("delete_funnel").handler({ funnelId: "f1" }, ctx);
    expect(state.funnels.remove).toHaveBeenCalledWith("f1");
    expect(out).toEqual({ deleted: true, funnelId: "f1" });
  });
});
