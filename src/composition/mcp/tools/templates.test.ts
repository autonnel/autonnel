import { describe, it, expect, vi } from "vitest";

const state = vi.hoisted(() => ({
  registry: [
    {
      value: "LP_SKINCARE",
      label: "Landing Page · Skincare",
      subtitle: "Cream-focused cosmetics funnel LP",
      section: "funnel",
      defaultPageType: "CUSTOM",
      defaultSlug: "lp-skincare",
      generator: () => ({ root: { props: {} }, content: [{ type: "HeroPanel", props: {} }], zones: {} }),
    },
    {
      value: "ERROR",
      label: "Error Page",
      subtitle: "Payment error handling",
      section: "utility",
      defaultPageType: "ERROR",
      generator: () => ({ root: { props: {} }, content: [], zones: {} }),
    },
  ],
}));

vi.mock("@/lib/templates/registry", () => ({
  TEMPLATE_REGISTRY: state.registry,
  getTemplateByValue: (v: string) => state.registry.find((t) => t.value === v),
  getTemplateData: (v: string) => state.registry.find((t) => t.value === v)?.generator(),
}));

import { pageTemplateTools } from "./templates";

const ctx = { locals: {} };
const byName = (name: string) => {
  const tool = pageTemplateTools().find((t) => t.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool;
};

describe("pageTemplateTools", () => {
  it("exposes two read-only tools guarded by PAGES", () => {
    expect(pageTemplateTools().map((t) => t.name).sort()).toEqual(["get_template", "list_templates"]);
    expect(pageTemplateTools().every((t) => t.writeAccess === false)).toBe(true);
    expect(pageTemplateTools().every((t) => t.requiredFeature === "PAGES")).toBe(true);
  });

  it("maps registry fields onto the API field names and omits content", async () => {
    const out: any = await byName("list_templates").handler({}, ctx);
    expect(out.count).toBe(2);
    expect(out.templates[0]).toEqual({
      key: "LP_SKINCARE",
      name: "Landing Page · Skincare",
      description: "Cream-focused cosmetics funnel LP",
      pageType: "CUSTOM",
      section: "funnel",
      defaultSlug: "lp-skincare",
    });
    expect(out.templates[0]).not.toHaveProperty("data");
    expect(out.templates[0]).not.toHaveProperty("editorType");
  });

  it("filters by pageType case-insensitively", async () => {
    const out: any = await byName("list_templates").handler({ pageType: "error" }, ctx);
    expect(out.templates.map((t: any) => t.key)).toEqual(["ERROR"]);
  });

  it("returns the full Puck JSON for one template", async () => {
    const out: any = await byName("get_template").handler({ key: "LP_SKINCARE" }, ctx);
    expect(out.key).toBe("LP_SKINCARE");
    expect(out.pageType).toBe("CUSTOM");
    expect(out.data.content).toEqual([{ type: "HeroPanel", props: {} }]);
  });

  it("rejects an unknown template key with a message naming it", async () => {
    await expect(byName("get_template").handler({ key: "NOPE" }, ctx)).rejects.toThrow(/NOPE/);
  });
});
