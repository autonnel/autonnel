import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copyCorePublicAssets, resolveCorePublicFile } from "./core-public-assets";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "core-public-"));
  const core = join(root, "core");
  const consumer = join(root, "consumer");
  const client = join(root, "client");
  mkdirSync(join(core, "images"), { recursive: true });
  mkdirSync(consumer, { recursive: true });
  mkdirSync(client, { recursive: true });
  writeFileSync(join(core, "storefront.css"), "core-css");
  writeFileSync(join(core, "images", "badge.svg"), "<svg/>");
  writeFileSync(join(core, "favicon.svg"), "core-icon");
  return { core, consumer, client };
}

describe("copyCorePublicAssets", () => {
  it("copies nested files into the client dir without overwriting the deployment's own", () => {
    const { core, client } = fixture();
    writeFileSync(join(client, "favicon.svg"), "own-icon");
    const copied = copyCorePublicAssets(core, client);
    expect(copied.sort()).toEqual(["images/badge.svg", "storefront.css"]);
    expect(readFileSync(join(client, "images", "badge.svg"), "utf8")).toBe("<svg/>");
    expect(readFileSync(join(client, "favicon.svg"), "utf8")).toBe("own-icon");
  });

  it("is a no-op when the core public dir is missing", () => {
    const { client } = fixture();
    expect(copyCorePublicAssets(join(client, "nope"), client)).toEqual([]);
  });
});

describe("resolveCorePublicFile", () => {
  it("serves core files, lets consumer files win and rejects traversal", () => {
    const { core, consumer } = fixture();
    writeFileSync(join(consumer, "favicon.svg"), "own");
    expect(resolveCorePublicFile(core, consumer, "/storefront.css?v=1")).toBe(join(core, "storefront.css"));
    expect(resolveCorePublicFile(core, consumer, "/images/badge.svg")).toBe(join(core, "images", "badge.svg"));
    expect(resolveCorePublicFile(core, consumer, "/favicon.svg")).toBeNull();
    expect(resolveCorePublicFile(core, consumer, "/../core/storefront.css")).toBeNull();
    expect(resolveCorePublicFile(core, consumer, "/%2e%2e/secret")).toBeNull();
    expect(resolveCorePublicFile(core, consumer, "/images")).toBeNull();
    expect(resolveCorePublicFile(core, consumer, "/missing.css")).toBeNull();
  });
});
