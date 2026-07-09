import { describe, it, expect } from "vitest";
import { CatalogProductView, CatalogVariantView } from "./catalog-projection";
import { ExternalRef } from "./value-objects/external-ref";
import { PresentmentPriceMap } from "./value-objects/presentment-price";
import { InventorySnapshot } from "./value-objects/inventory-snapshot";
import { Market } from "./value-objects/market";
import { Money } from "../../shared-kernel/money";

function variant(priceMinor: number | null): CatalogVariantView {
  const prices = priceMinor === null
    ? PresentmentPriceMap.from([])
    : PresentmentPriceMap.from([{ market: Market.of("US", "USD"), price: Money.of(priceMinor, "USD") }]);
  return CatalogVariantView.create({
    externalVariantRef: ExternalRef.of("gid://v/1"),
    title: "Default",
    sku: "SKU1",
    presentmentPrices: prices,
    inventory: InventorySnapshot.of(10, "deny", new Date()),
  });
}

describe("CatalogProductView", () => {
  it("flags a zero/absent-price variant as price-unavailable, never priced 0", () => {
    const v = variant(null);
    expect(v.hasResolvablePrice()).toBe(false);
  });
  it("identity is the external triple, never autonnel-generated", () => {
    const p = CatalogProductView.create({
      backendKind: "shopify",
      externalProductRef: ExternalRef.of("gid://p/1"),
      title: "Tee",
      status: "active",
      mediaRefs: [],
      variants: [variant(1999)],
    });
    expect(p.identityKey()).toBe("shopify:gid://p/1");
    expect(p.isTombstoned()).toBe(false);
  });
  it("tombstones on delete but keeps variants for in-flight resolution", () => {
    const p = CatalogProductView.create({
      backendKind: "shopify",
      externalProductRef: ExternalRef.of("gid://p/1"),
      title: "Tee",
      status: "active",
      mediaRefs: [],
      variants: [variant(1999)],
    });
    p.tombstone(new Date());
    expect(p.isTombstoned()).toBe(true);
    expect(p.variants.length).toBe(1);
  });
});
