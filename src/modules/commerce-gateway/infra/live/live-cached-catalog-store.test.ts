import { describe, it, expect, vi, beforeEach } from "vitest";
import { LiveCachedCatalogStore, clearLiveCatalogCache } from "./live-cached-catalog-store";
import { CatalogProductView, CatalogVariantView } from "../../domain/catalog-projection";
import { SyncCursor } from "../../domain/value-objects/sync-cursor";
import { ExternalRef } from "../../domain/value-objects/external-ref";
import { PresentmentPriceMap } from "../../domain/value-objects/presentment-price";
import { InventorySnapshot } from "../../domain/value-objects/inventory-snapshot";
import { Market } from "../../domain/value-objects/market";
import { Money } from "../../../shared-kernel/money";
import type { BackendCatalogPort } from "../../application/ports/outbound";

function product(ref: string, title: string, variantRef = `${ref}-v`, deleted = false): CatalogProductView {
  return CatalogProductView.create({
    backendKind: "shopify",
    externalProductRef: ExternalRef.of(ref),
    title,
    status: "active",
    mediaRefs: [],
    deletedAtSource: deleted ? new Date() : undefined,
    variants: [
      CatalogVariantView.create({
        externalVariantRef: ExternalRef.of(variantRef),
        title: "Default",
        presentmentPrices: PresentmentPriceMap.from([
          { market: Market.of("US", "USD"), price: Money.of(1999, "USD") },
        ]),
        inventory: InventorySnapshot.of(5, "deny", new Date()),
      }),
    ],
  });
}

function backendWithPages(pages: Array<{ products: CatalogProductView[]; nextCursor: SyncCursor | null }>): BackendCatalogPort {
  let i = 0;
  return { listProducts: vi.fn(async () => pages[Math.min(i++, pages.length - 1)]) } as unknown as BackendCatalogPort;
}

beforeEach(() => clearLiveCatalogCache());

describe("LiveCachedCatalogStore", () => {
  it("crawls backend pages and lists with offset/limit + hasMore", async () => {
    const backend = backendWithPages([
      { products: [product("p1", "Alpha"), product("p2", "Beta")], nextCursor: SyncCursor.of("c1") },
      { products: [product("p3", "Gamma")], nextCursor: null },
    ]);
    const store = new LiveCachedCatalogStore(backend, "t:US");
    const page1 = await store.listProducts(2, 0);
    expect(page1.products.map((p) => p.title)).toEqual(["Alpha", "Beta"]);
    expect(page1.hasMore).toBe(true);
    const page2 = await store.listProducts(2, 2);
    expect(page2.products.map((p) => p.title)).toEqual(["Gamma"]);
    expect(page2.hasMore).toBe(false);
  });

  it("caches the crawl: the backend is hit once across reads within TTL", async () => {
    const backend = backendWithPages([{ products: [product("p1", "Alpha")], nextCursor: null }]);
    const store = new LiveCachedCatalogStore(backend, "t:US");
    await store.listProducts(50, 0);
    await store.search("alpha", 50);
    await store.findByProductRef(ExternalRef.of("p1"));
    expect((backend.listProducts as any).mock.calls.length).toBe(1);
  });

  it("filters tombstoned products from list/search but resolves variants regardless", async () => {
    const backend = backendWithPages([
      { products: [product("p1", "Alpha"), product("p2", "Hidden", "p2-v", true)], nextCursor: null },
    ]);
    const store = new LiveCachedCatalogStore(backend, "t:US");
    expect((await store.listProducts(50, 0)).products.map((p) => p.title)).toEqual(["Alpha"]);
    expect(await store.search("hidden", 50)).toHaveLength(0);
  });

  it("search matches title case-insensitively", async () => {
    const backend = backendWithPages([
      { products: [product("p1", "Red Shoe"), product("p2", "Blue Hat")], nextCursor: null },
    ]);
    const store = new LiveCachedCatalogStore(backend, "t:US");
    expect((await store.search("shoe", 50)).map((p) => p.title)).toEqual(["Red Shoe"]);
  });

  it("findByVariantRefs returns products containing the requested variants", async () => {
    const backend = backendWithPages([
      { products: [product("p1", "Alpha", "v1"), product("p2", "Beta", "v2")], nextCursor: null },
    ]);
    const store = new LiveCachedCatalogStore(backend, "t:US");
    const found = await store.findByVariantRefs([ExternalRef.of("v2")]);
    expect(found.map((p) => p.title)).toEqual(["Beta"]);
  });

  it("caps the crawl at maxProducts", async () => {
    const backend = backendWithPages([
      { products: [product("p1", "A"), product("p2", "B"), product("p3", "C")], nextCursor: SyncCursor.of("c1") },
    ]);
    const store = new LiveCachedCatalogStore(backend, "t:US", { maxProducts: 2, pageSize: 3 });
    const all = await store.listProducts(50, 0);
    expect(all.products).toHaveLength(2);
  });

  it("write methods are unsupported", async () => {
    const store = new LiveCachedCatalogStore(backendWithPages([{ products: [], nextCursor: null }]), "t:US");
    await expect(store.upsertProducts()).rejects.toThrow(/read-only/);
    await expect(store.tombstoneStaleProducts()).rejects.toThrow(/read-only/);
  });
});
