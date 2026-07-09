import { describe, it, expect } from "vitest";
import { ReadStorefrontCatalogService } from "./read-storefront-catalog.service";
import { CatalogProductView, CatalogVariantView } from "../domain/catalog-projection";
import { ExternalRef } from "../domain/value-objects/external-ref";
import { Market } from "../domain/value-objects/market";
import { PresentmentPriceMap } from "../domain/value-objects/presentment-price";
import { InventorySnapshot } from "../domain/value-objects/inventory-snapshot";
import { Money } from "../../shared-kernel/money";
import type {
  CatalogProjectionStorePort,
  CatalogProjectionListResult,
} from "./ports/outbound";

function multiCurrencyProduct(): CatalogProductView {
  return CatalogProductView.create({
    backendKind: "shopify",
    externalProductRef: ExternalRef.of("gid://p/1"),
    title: "Tee",
    status: "active",
    mediaRefs: ["https://cdn/p1.jpg"],
    variants: [
      CatalogVariantView.create({
        externalVariantRef: ExternalRef.of("gid://v/1"),
        title: "Small",
        presentmentPrices: PresentmentPriceMap.from([
          { market: Market.of("US", "USD"), price: Money.of(1999, "USD"), compareAtPrice: Money.of(2499, "USD") },
          { market: Market.of("DE", "EUR"), price: Money.of(1799, "EUR"), compareAtPrice: Money.of(2299, "EUR") },
        ]),
        inventory: InventorySnapshot.of(5, "deny", new Date()),
      }),
    ],
  });
}

function fakeStore(over: Partial<CatalogProjectionStorePort> = {}): CatalogProjectionStorePort {
  const list: CatalogProjectionListResult = { products: [multiCurrencyProduct()], hasMore: true };
  return {
    upsertProducts: async () => {},
    tombstoneProducts: async () => {},
    tombstoneStaleProducts: async () => {},
    findByVariantRefs: async () => [],
    search: async () => [multiCurrencyProduct()],
    listProducts: async () => list,
    findByProductRef: async () => multiCurrencyProduct(),
    distinctCurrencyCodes: async () => ["USD", "EUR"],
    ...over,
  };
}

describe("ReadStorefrontCatalogService", () => {
  it("lists product-grouped views and propagates hasMore", async () => {
    const svc = new ReadStorefrontCatalogService(fakeStore());
    const result = await svc.list({ limit: 10, offset: 0 });
    expect(result.hasMore).toBe(true);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].variants).toHaveLength(1);
    expect(result.products[0].thumbnail).toBe("https://cdn/p1.jpg");
  });

  it("resolves price for the requested currency (regionId pricing)", async () => {
    const svc = new ReadStorefrontCatalogService(fakeStore());
    const product = await svc.getByRef("gid://p/1", { currencyCode: "EUR" });
    expect(product?.priceMinor).toBe(1799);
    expect(product?.currencyCode).toBe("EUR");
    expect(product?.variants[0].currencyCode).toBe("EUR");
  });

  it("resolves compare-at price from the same market as the displayed price", async () => {
    const svc = new ReadStorefrontCatalogService(fakeStore());
    const eur = await svc.getByRef("gid://p/1", { currencyCode: "EUR" });
    expect(eur?.comparePriceMinor).toBe(2299);
    expect(eur?.variants[0].comparePriceMinor).toBe(2299);

    const usd = await svc.getByRef("gid://p/1", { currencyCode: "USD", countryCode: "US" });
    expect(usd?.comparePriceMinor).toBe(2499);
    expect(usd?.variants[0].comparePriceMinor).toBe(2499);
  });

  it("returns null comparePriceMinor when the variant has no compare-at price", async () => {
    const noCompare = CatalogProductView.create({
      backendKind: "shopify",
      externalProductRef: ExternalRef.of("gid://p/3"),
      title: "Plain",
      status: "active",
      mediaRefs: [],
      variants: [
        CatalogVariantView.create({
          externalVariantRef: ExternalRef.of("gid://v/3"),
          title: "Only",
          presentmentPrices: PresentmentPriceMap.from([
            { market: Market.of("US", "USD"), price: Money.of(1999, "USD") },
          ]),
          inventory: InventorySnapshot.of(1, "deny", new Date()),
        }),
      ],
    });
    const svc = new ReadStorefrontCatalogService(fakeStore({ findByProductRef: async () => noCompare }));
    const product = await svc.getByRef("gid://p/3", { currencyCode: "USD" });
    expect(product?.priceMinor).toBe(1999);
    expect(product?.comparePriceMinor).toBeNull();
    expect(product?.variants[0].comparePriceMinor).toBeNull();
  });

  it("prefers the exact country+currency market when both are given", async () => {
    const svc = new ReadStorefrontCatalogService(fakeStore());
    const product = await svc.getByRef("gid://p/1", { currencyCode: "USD", countryCode: "US" });
    expect(product?.priceMinor).toBe(1999);
    expect(product?.currencyCode).toBe("USD");
  });

  it("falls back to any available price when no currency matches", async () => {
    const svc = new ReadStorefrontCatalogService(fakeStore());
    const product = await svc.getByRef("gid://p/1", { currencyCode: "GBP" });
    expect(product?.priceMinor).toBe(1999);
    expect(product?.currencyCode).toBe("USD");
  });

  it("returns null priceMinor when the projection has no prices", async () => {
    const noPrice = CatalogProductView.create({
      backendKind: "shopify",
      externalProductRef: ExternalRef.of("gid://p/2"),
      title: "Empty",
      status: "active",
      mediaRefs: [],
      variants: [
        CatalogVariantView.create({
          externalVariantRef: ExternalRef.of("gid://v/2"),
          title: "Only",
          presentmentPrices: PresentmentPriceMap.from([]),
          inventory: InventorySnapshot.of(null, "unknown", new Date()),
        }),
      ],
    });
    const svc = new ReadStorefrontCatalogService(fakeStore({ findByProductRef: async () => noPrice }));
    const product = await svc.getByRef("gid://p/2", {});
    expect(product?.priceMinor).toBeNull();
    expect(product?.currencyCode).toBeNull();
  });

  it("searches the projection", async () => {
    const svc = new ReadStorefrontCatalogService(fakeStore());
    const results = await svc.search("tee", { limit: 5, offset: 0, currencyCode: "USD" });
    expect(results[0].title).toBe("Tee");
  });

  it("exposes the distinct currencies in the catalog", async () => {
    const svc = new ReadStorefrontCatalogService(fakeStore());
    expect(await svc.availableCurrencies()).toEqual(["USD", "EUR"]);
  });
});
