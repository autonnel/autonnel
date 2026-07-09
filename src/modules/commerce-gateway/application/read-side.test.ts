import { describe, it, expect } from "vitest";
import { ResolvePurchasablesService } from "./resolve-purchasables.service";
import { SearchCatalogService } from "./search-catalog.service";
import { CatalogProductView, CatalogVariantView } from "../domain/catalog-projection";
import { PurchasableAssembler } from "../domain/services/purchasable-assembler";
import { PriceResolver } from "../domain/services/price-resolver";
import { SellabilityPolicy } from "../domain/services/sellability-policy";
import { ExternalRef } from "../domain/value-objects/external-ref";
import { Market } from "../domain/value-objects/market";
import { PresentmentPriceMap } from "../domain/value-objects/presentment-price";
import { InventorySnapshot } from "../domain/value-objects/inventory-snapshot";
import { Money } from "../../shared-kernel/money";
import type { CatalogProjectionStorePort } from "./ports/outbound";

function product(): CatalogProductView {
  return CatalogProductView.create({
    backendKind: "shopify",
    externalProductRef: ExternalRef.of("gid://p/1"),
    title: "Tee",
    status: "active",
    mediaRefs: [],
    variants: [
      CatalogVariantView.create({
        externalVariantRef: ExternalRef.of("gid://v/1"),
        title: "Default",
        presentmentPrices: PresentmentPriceMap.from([
          { market: Market.of("US", "USD"), price: Money.of(1999, "USD") },
        ]),
        inventory: InventorySnapshot.of(5, "deny", new Date()),
      }),
    ],
  });
}

const store: CatalogProjectionStorePort = {
  upsertProducts: async () => {},
  tombstoneProducts: async () => {},
  tombstoneStaleProducts: async () => {},
  findByVariantRefs: async () => [product()],
  search: async () => [product()],
  listProducts: async () => ({ products: [product()], hasMore: false }),
  findByProductRef: async () => product(),
  distinctCurrencyCodes: async () => ["USD"],
};

const assembler = new PurchasableAssembler(new PriceResolver(), new SellabilityPolicy(3600_000));

describe("ResolvePurchasablesService", () => {
  it("resolves variant refs into Purchasables for the requested market", async () => {
    const svc = new ResolvePurchasablesService(store, assembler);
    const result = await svc.execute({ variantRefs: [ExternalRef.of("gid://v/1")], market: Market.of("US", "USD") });
    expect(result).toHaveLength(1);
    expect(result[0].price?.amountMinor).toBe(1999);
    expect(result[0].sellability.isSellable()).toBe(true);
  });
  it("skips variant refs not present in the projection", async () => {
    const svc = new ResolvePurchasablesService(store, assembler);
    const result = await svc.execute({ variantRefs: [ExternalRef.of("gid://missing")], market: Market.of("US", "USD") });
    expect(result).toHaveLength(0);
  });
});

describe("SearchCatalogService", () => {
  it("returns assembled Purchasables for a search term", async () => {
    const svc = new SearchCatalogService(store, assembler);
    const result = await svc.execute("tee", 10);
    expect(result[0].title).toContain("Tee");
  });
});
