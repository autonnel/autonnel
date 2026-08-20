import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  funnelComposing: {
    addStep: vi.fn(),
    replaceStep: vi.fn(),
    removeStep: vi.fn(),
    setStepSlug: vi.fn(),
  },
}));

vi.mock("@/composition/make-authoring", () => ({
  makeAuthoring: () => ({ funnelComposing: state.funnelComposing }),
}));
vi.mock("@/composition/authoring-runtime", () => ({
  authoringDepsFromLocals: () => ({}),
}));

import { funnelStepTools } from "./funnel-steps";

const ctx = { locals: {} };
const byName = (name: string) => {
  const tool = funnelStepTools().find((t) => t.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool;
};

beforeEach(() => vi.clearAllMocks());

describe("funnelStepTools descriptors", () => {
  it("exposes four write tools, all requiring FUNNELS", () => {
    expect(funnelStepTools().map((t) => t.name).sort()).toEqual([
      "add_funnel_page",
      "remove_funnel_page",
      "replace_funnel_page",
      "set_funnel_step_slug",
    ]);
    expect(funnelStepTools().every((t) => t.writeAccess)).toBe(true);
    expect(funnelStepTools().every((t) => t.requiredFeature === "FUNNELS")).toBe(true);
  });
});

describe("add_funnel_page", () => {
  it("requires stepSlug and rejects input without it", () => {
    const parsed = byName("add_funnel_page").inputSchema.safeParse({
      funnelId: "f1",
      pageId: "p1",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a pageType argument instead of silently ignoring it", () => {
    const parsed = byName("add_funnel_page").inputSchema.safeParse({
      funnelId: "f1",
      pageId: "p1",
      stepSlug: "lp",
      pageType: "LANDING",
    });
    expect(parsed.success).toBe(false);
  });

  it("appends the step and echoes it back", async () => {
    state.funnelComposing.addStep.mockResolvedValue(undefined);
    const out: any = await byName("add_funnel_page").handler(
      { funnelId: "f1", pageId: "p1", stepSlug: "lp" },
      ctx,
    );
    expect(state.funnelComposing.addStep).toHaveBeenCalledWith({
      funnelId: "f1",
      pageId: "p1",
      stepSlug: "lp",
    });
    expect(out).toEqual({ funnelId: "f1", stepSlug: "lp", pageId: "p1" });
  });

  it("lets a duplicate-slug domain error surface unchanged", async () => {
    state.funnelComposing.addStep.mockRejectedValue(
      new Error('stepSlug must be unique within funnel: "lp"'),
    );
    await expect(
      byName("add_funnel_page").handler({ funnelId: "f1", pageId: "p2", stepSlug: "lp" }, ctx),
    ).rejects.toThrow(/unique within funnel/);
  });
});

describe("replace_funnel_page", () => {
  it("swaps the page a step points at", async () => {
    state.funnelComposing.replaceStep.mockResolvedValue(undefined);
    const out: any = await byName("replace_funnel_page").handler(
      { funnelId: "f1", fromPageId: "p1", toPageId: "p2" },
      ctx,
    );
    expect(state.funnelComposing.replaceStep).toHaveBeenCalledWith({
      funnelId: "f1",
      fromPageId: "p1",
      toPageId: "p2",
    });
    expect(out).toEqual({ funnelId: "f1", fromPageId: "p1", toPageId: "p2" });
  });
});

describe("remove_funnel_page", () => {
  it("removes the step keyed by pageId", async () => {
    state.funnelComposing.removeStep.mockResolvedValue(undefined);
    const out: any = await byName("remove_funnel_page").handler(
      { funnelId: "f1", pageId: "p1" },
      ctx,
    );
    expect(state.funnelComposing.removeStep).toHaveBeenCalledWith({ funnelId: "f1", pageId: "p1" });
    expect(out).toEqual({ removed: true, funnelId: "f1", pageId: "p1" });
  });
});

describe("set_funnel_step_slug", () => {
  it("renames the slug of an existing step", async () => {
    state.funnelComposing.setStepSlug.mockResolvedValue(undefined);
    const out: any = await byName("set_funnel_step_slug").handler(
      { funnelId: "f1", pageId: "p1", stepSlug: "offer" },
      ctx,
    );
    expect(state.funnelComposing.setStepSlug).toHaveBeenCalledWith({
      funnelId: "f1",
      pageId: "p1",
      stepSlug: "offer",
    });
    expect(out).toEqual({ funnelId: "f1", pageId: "p1", stepSlug: "offer" });
  });
});
