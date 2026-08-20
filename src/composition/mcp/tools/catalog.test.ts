import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  searchCatalog: vi.fn(),
  store: vi.fn(),
  safeFetch: vi.fn(),
}));

vi.mock("@/composition/make-commerce-gateway", () => ({
  makeCommerceGatewayReadSide: async () => ({ searchCatalog: state.searchCatalog }),
}));
vi.mock("@/composition/make-ai-media-deps", () => ({
  makeAiMediaUpload: async () => ({ store: state.store }),
}));
vi.mock("@/lib/utils/safe-url", () => ({ safeFetch: state.safeFetch }));

import { catalogTools, MEDIA_MAX_BYTES } from "./catalog";

const ctx = { locals: {} };
const byName = (name: string) => {
  const tool = catalogTools().find((t) => t.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool;
};

function imageResponse(contentType = "image/png", bytes = new Uint8Array([1, 2, 3])) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": contentType }),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as Response;
}

beforeEach(() => vi.clearAllMocks());

describe("catalogTools descriptors", () => {
  it("marks only upload_media as a write tool", () => {
    expect(catalogTools().map((t) => t.name).sort()).toEqual(["list_products", "upload_media"]);
    expect(catalogTools().filter((t) => t.writeAccess).map((t) => t.name)).toEqual(["upload_media"]);
    expect(catalogTools().every((t) => t.requiredFeature === "PAGES")).toBe(true);
  });
});

describe("list_products", () => {
  it("searches the connected catalog and clamps limit to 250", async () => {
    state.searchCatalog.mockResolvedValue([{ id: "gid://1", title: "Cream" }]);
    const out: any = await byName("list_products").handler({ search: "cream", limit: 9999 }, ctx);
    expect(state.searchCatalog).toHaveBeenCalledWith("cream", 250);
    expect(out.products).toEqual([{ id: "gid://1", title: "Cream" }]);
    expect(out.count).toBe(1);
  });

  it("defaults to an empty search term and a limit of 50", async () => {
    state.searchCatalog.mockResolvedValue([]);
    await byName("list_products").handler({}, ctx);
    expect(state.searchCatalog).toHaveBeenCalledWith("", 50);
  });
});

describe("upload_media", () => {
  it("downloads through safeFetch with a byte cap, then stores the bytes", async () => {
    state.safeFetch.mockResolvedValue(imageResponse());
    state.store.mockResolvedValue({ assetId: "a1", url: "https://cdn.example.com/a1.webp" });
    const out: any = await byName("upload_media").handler(
      { url: "https://example.com/hero.png" },
      ctx,
    );
    expect(state.safeFetch).toHaveBeenCalledWith(
      "https://example.com/hero.png",
      expect.objectContaining({ maxBytes: MEDIA_MAX_BYTES }),
    );
    expect(state.store).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "image/png" }),
    );
    expect(out).toEqual({ assetId: "a1", url: "https://cdn.example.com/a1.webp" });
  });

  it("rejects a content type outside the allow-list", async () => {
    state.safeFetch.mockResolvedValue(imageResponse("application/pdf"));
    await expect(
      byName("upload_media").handler({ url: "https://example.com/x.pdf" }, ctx),
    ).rejects.toThrow(/application\/pdf/);
    expect(state.store).not.toHaveBeenCalled();
  });

  it("rejects a non-OK download reporting the status", async () => {
    state.safeFetch.mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response);
    await expect(
      byName("upload_media").handler({ url: "https://example.com/missing.png" }, ctx),
    ).rejects.toThrow(/404/);
  });

  it("rejects an empty download rather than storing a zero-byte asset", async () => {
    state.safeFetch.mockResolvedValue(imageResponse("image/png", new Uint8Array()));
    await expect(
      byName("upload_media").handler({ url: "https://example.com/empty.png" }, ctx),
    ).rejects.toThrow(/empty/i);
    expect(state.store).not.toHaveBeenCalled();
  });

  it("strips charset parameters off the content type before matching", async () => {
    state.safeFetch.mockResolvedValue(imageResponse("image/png; charset=binary"));
    state.store.mockResolvedValue({ assetId: "a2", url: "https://cdn.example.com/a2.webp" });
    await byName("upload_media").handler({ url: "https://example.com/a.png" }, ctx);
    expect(state.store).toHaveBeenCalledWith(expect.objectContaining({ contentType: "image/png" }));
  });

  it("rejects a non-http scheme at the schema level", () => {
    const parsed = byName("upload_media").inputSchema.safeParse({ url: "file:///etc/passwd" });
    expect(parsed.success).toBe(false);
  });
});
