import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  pageDashboard: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  templateData: { root: { props: {} }, content: [], zones: {} },
}));

vi.mock("@/composition/make-authoring", () => ({
  makeAuthoring: () => ({ pageDashboard: state.pageDashboard }),
}));
vi.mock("@/composition/authoring-runtime", () => ({
  authoringDepsFromLocals: () => ({}),
}));
vi.mock("@/lib/templates/registry", () => ({
  getTemplateData: vi.fn(() => state.templateData),
}));

import { pageTools } from "./pages";
import { getTemplateData } from "@/lib/templates/registry";

const ctx = { locals: {} };
const byName = (name: string) => {
  const tool = pageTools().find((t) => t.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pageTools descriptors", () => {
  it("exposes exactly the four page tools", () => {
    expect(pageTools().map((t) => t.name).sort()).toEqual([
      "create_page",
      "get_page",
      "list_pages",
      "update_page",
    ]);
  });

  it("marks only the mutations as write tools and requires PAGES throughout", () => {
    const write = pageTools().filter((t) => t.writeAccess).map((t) => t.name).sort();
    expect(write).toEqual(["create_page", "update_page"]);
    expect(pageTools().every((t) => t.requiredFeature === "PAGES")).toBe(true);
  });
});

describe("list_pages", () => {
  it("returns items with pagination and clamps limit to 100", async () => {
    state.pageDashboard.list.mockResolvedValue({
      items: [{ id: "p1", name: "LP", slug: "lp", type: "custom", status: "PUBLISHED", editorType: "PUCK" }],
      total: 1,
      page: 1,
      perPage: 100,
      totalPages: 1,
      bindings: [{ pageId: "p1", funnelId: "f1", funnelName: "F" }],
    });
    const out: any = await byName("list_pages").handler({ limit: 500 }, ctx);
    expect(state.pageDashboard.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 100 }),
    );
    expect(out.pages[0].id).toBe("p1");
    expect(out.pages[0].funnels).toEqual([{ funnelId: "f1", funnelName: "F" }]);
    expect(out.pagination).toEqual({ page: 1, limit: 100, total: 1, totalPages: 1 });
  });

  it("normalizes an uppercase type filter to lowercase", async () => {
    state.pageDashboard.list.mockResolvedValue({
      items: [], total: 0, page: 1, perPage: 20, totalPages: 1, bindings: [],
    });
    await byName("list_pages").handler({ type: "CHECKOUT" }, ctx);
    expect(state.pageDashboard.list).toHaveBeenCalledWith(
      expect.objectContaining({ type: "checkout" }),
    );
  });
});

describe("get_page", () => {
  it("returns the page with its draft and published data", async () => {
    state.pageDashboard.get.mockResolvedValue({
      id: "p1", name: "LP", slug: "lp", type: "custom", status: "DRAFT", editorType: "PUCK",
      templateName: "LP_SKINCARE", draftData: { content: [] }, publishedData: null,
      htmlContent: null, draftHtml: null, meta: { title: "LP" }, publishedAt: null,
    });
    const out: any = await byName("get_page").handler({ pageId: "p1" }, ctx);
    expect(state.pageDashboard.get).toHaveBeenCalledWith("p1");
    expect(out.id).toBe("p1");
    expect(out.draftData).toEqual({ content: [] });
    expect(out.publishedData).toBeNull();
  });
});

describe("create_page", () => {
  it("normalizes an uppercase type and defaults editorType to PUCK", async () => {
    state.pageDashboard.create.mockResolvedValue({ id: "p2", slug: "co", type: "checkout" });
    await byName("create_page").handler({ name: "CO", slug: "co", type: "CHECKOUT" }, ctx);
    expect(state.pageDashboard.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "CO", slug: "co", type: "checkout", editorType: "PUCK" }),
    );
  });

  it("seeds draftData from the template when templateKey is given", async () => {
    state.pageDashboard.create.mockResolvedValue({ id: "p3", slug: "lp", type: "custom" });
    await byName("create_page").handler(
      { name: "LP", slug: "lp", type: "custom", templateKey: "LP_SKINCARE" },
      ctx,
    );
    expect(getTemplateData).toHaveBeenCalledWith("LP_SKINCARE");
    expect(state.pageDashboard.create).toHaveBeenCalledWith(
      expect.objectContaining({ templateName: "LP_SKINCARE", draftData: state.templateData }),
    );
  });

  it("prefers an explicit draftData over the template", async () => {
    state.pageDashboard.create.mockResolvedValue({ id: "p4", slug: "lp2", type: "custom" });
    const draftData = { root: { props: {} }, content: [{ type: "HeroPanel", props: {} }] };
    await byName("create_page").handler(
      { name: "LP2", slug: "lp2", type: "custom", templateKey: "LP_SKINCARE", draftData },
      ctx,
    );
    expect(state.pageDashboard.create).toHaveBeenCalledWith(
      expect.objectContaining({ draftData }),
    );
  });

  it("rejects an unknown page type through the schema", () => {
    const parsed = byName("create_page").inputSchema.safeParse({
      name: "X", slug: "x", type: "LANDING",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects htmlContent through the schema (pageDashboard.create has no such field)", () => {
    const parsed = byName("create_page").inputSchema.safeParse({
      name: "X", slug: "x", type: "custom", htmlContent: "<div>hi</div>",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("update_page", () => {
  beforeEach(() => {
    state.pageDashboard.get.mockResolvedValue({ id: "p1", editorType: "PUCK" });
  });

  it("writes to draft without publishing by default", async () => {
    state.pageDashboard.update.mockResolvedValue({ id: "p1", slug: "lp", status: "DRAFT" });
    await byName("update_page").handler({ pageId: "p1", draftData: { content: [] } }, ctx);
    expect(state.pageDashboard.update).toHaveBeenCalledWith("p1", { draftData: { content: [] } });
  });

  it("promotes draft to live when publish is true", async () => {
    state.pageDashboard.update.mockResolvedValue({ id: "p1", slug: "lp", status: "PUBLISHED" });
    await byName("update_page").handler({ pageId: "p1", publish: true }, ctx);
    expect(state.pageDashboard.update).toHaveBeenCalledWith("p1", { status: "PUBLISHED" });
  });

  it("applies content edits and the publish flag in one call", async () => {
    state.pageDashboard.update.mockResolvedValue({ id: "p1", slug: "lp", status: "PUBLISHED" });
    await byName("update_page").handler({ pageId: "p1", name: "New", publish: true }, ctx);
    expect(state.pageDashboard.update).toHaveBeenCalledWith("p1", {
      name: "New",
      status: "PUBLISHED",
    });
  });

  it("does not send a status key when publish is false", async () => {
    state.pageDashboard.update.mockResolvedValue({ id: "p1", slug: "lp", status: "DRAFT" });
    await byName("update_page").handler({ pageId: "p1", publish: false, name: "N" }, ctx);
    expect(state.pageDashboard.update).toHaveBeenCalledWith("p1", { name: "N" });
  });

  it("rejects htmlContent on a PUCK page instead of writing a column nothing renders", async () => {
    await expect(
      byName("update_page").handler({ pageId: "p1", htmlContent: "<h1>hi</h1>" }, ctx),
    ).rejects.toThrow(/editorType PUCK; use draftData/);
    expect(state.pageDashboard.update).not.toHaveBeenCalled();
  });

  it("rejects draftData on an HTML page", async () => {
    state.pageDashboard.get.mockResolvedValue({ id: "p1", editorType: "HTML" });
    await expect(
      byName("update_page").handler({ pageId: "p1", draftData: { content: [] }, publish: true }, ctx),
    ).rejects.toThrow(/editorType HTML; use htmlContent/);
    expect(state.pageDashboard.update).not.toHaveBeenCalled();
  });

  it("accepts htmlContent on an HTML page", async () => {
    state.pageDashboard.get.mockResolvedValue({ id: "p1", editorType: "HTML" });
    state.pageDashboard.update.mockResolvedValue({ id: "p1", slug: "lp", status: "PUBLISHED" });
    await byName("update_page").handler({ pageId: "p1", htmlContent: "<h1>hi</h1>", publish: true }, ctx);
    expect(state.pageDashboard.update).toHaveBeenCalledWith("p1", {
      htmlContent: "<h1>hi</h1>",
      status: "PUBLISHED",
    });
  });

  it("accepts htmlContent on a GRAPESJS page", async () => {
    state.pageDashboard.get.mockResolvedValue({ id: "p1", editorType: "GRAPESJS" });
    state.pageDashboard.update.mockResolvedValue({ id: "p1", slug: "lp", status: "DRAFT" });
    await byName("update_page").handler({ pageId: "p1", htmlContent: "<h1>hi</h1>" }, ctx);
    expect(state.pageDashboard.update).toHaveBeenCalledWith("p1", { htmlContent: "<h1>hi</h1>" });
  });

  it("treats a legacy blank editorType as PUCK", async () => {
    state.pageDashboard.get.mockResolvedValue({ id: "p1", editorType: "" });
    await expect(
      byName("update_page").handler({ pageId: "p1", htmlContent: "<h1>hi</h1>" }, ctx),
    ).rejects.toThrow(/editorType PUCK/);
  });
});
