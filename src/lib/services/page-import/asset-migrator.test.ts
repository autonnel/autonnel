import { describe, it, expect, vi, beforeEach } from "vitest";

let inFlight = 0;
let peak = 0;
const uploadFromUrl = vi.fn(async (url: string) => {
  inFlight++;
  peak = Math.max(peak, inFlight);
  await new Promise((r) => setTimeout(r, 5));
  inFlight--;
  return `cdn/${encodeURIComponent(url)}`;
});

vi.mock("@/lib/s3", () => ({
  uploadFromUrl: (...args: unknown[]) => uploadFromUrl(...(args as [string])),
}));
vi.mock("@/lib/services/site-upload", () => ({
  buildUrlFromContext: (key: string) => `https://static.test/${key}`,
}));

import { migrateAssets, type MigrateAssetsContext } from "./asset-migrator";

const ctx: MigrateAssetsContext = {
  baseFolder: "imports",
  uploadCtx: {} as never,
  s3Config: {} as never,
};

describe("migrateAssets", () => {
  beforeEach(() => {
    uploadFromUrl.mockClear();
    inFlight = 0;
    peak = 0;
  });

  it("rewrites img/link/style URLs to the migrated CDN URL", async () => {
    const html =
      '<img src="https://src.test/a.png">' +
      '<link rel="stylesheet" href="https://src.test/x.css">' +
      '<div style="background:url(https://src.test/bg.jpg)"></div>';
    const { html: out, migrated } = await migrateAssets(html, "https://src.test/page", ctx);

    expect(migrated).toBe(3);
    expect(out).toContain("https://static.test/cdn/");
    expect(out).not.toContain("https://src.test/a.png");
    expect(out).not.toContain("https://src.test/bg.jpg");
  });

  it("dedups identical URLs to a single upload", async () => {
    const html = '<img src="https://src.test/dup.png"><img src="https://src.test/dup.png">';
    const { migrated } = await migrateAssets(html, "https://src.test/page", ctx);
    expect(migrated).toBe(1);
    expect(uploadFromUrl).toHaveBeenCalledTimes(1);
  });

  it("caps concurrent uploads at the bound", async () => {
    const imgs = Array.from({ length: 20 }, (_, i) => `<img src="https://src.test/${i}.png">`).join("");
    await migrateAssets(imgs, "https://src.test/page", ctx);
    expect(uploadFromUrl).toHaveBeenCalledTimes(20);
    expect(peak).toBeLessThanOrEqual(5);
    expect(peak).toBeGreaterThan(1);
  });

  it("leaves the original URL when an upload fails", async () => {
    uploadFromUrl.mockRejectedValueOnce(new Error("boom"));
    const { migrated, html: out } = await migrateAssets(
      '<img src="https://src.test/fail.png">',
      "https://src.test/page",
      ctx,
    );
    expect(migrated).toBe(0);
    expect(out).toContain("https://src.test/fail.png");
  });

  it("preserves srcset descriptors", async () => {
    const html = '<img srcset="https://src.test/a.png 1x, https://src.test/b.png 2x">';
    const { html: out } = await migrateAssets(html, "https://src.test/page", ctx);
    expect(out).toContain(" 1x");
    expect(out).toContain(" 2x");
    expect(out).toContain("https://static.test/cdn/");
  });
});
