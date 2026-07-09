import { describe, it, expect } from "vitest";
import { PurchasableAssembler } from "./purchasable-assembler";
import { ErrorClassifier } from "./error-classifier";
import { PriceResolver } from "./price-resolver";
import { SellabilityPolicy } from "./sellability-policy";
import { CatalogProductView, CatalogVariantView } from "../catalog-projection";
import { ExternalRef } from "../value-objects/external-ref";
import { PresentmentPriceMap } from "../value-objects/presentment-price";
import { InventorySnapshot } from "../value-objects/inventory-snapshot";
import { Market } from "../value-objects/market";
import { Money } from "../../../shared-kernel/money";
import { BackendErrorClass } from "../value-objects/backend-error";

const now = new Date("2026-06-04T12:00:00Z");

function product(priced: boolean): CatalogProductView {
  const prices = priced
    ? PresentmentPriceMap.from([{ market: Market.of("US", "USD"), price: Money.of(1999, "USD") }])
    : PresentmentPriceMap.from([]);
  return CatalogProductView.create({
    backendKind: "shopify",
    externalProductRef: ExternalRef.of("gid://p/1"),
    title: "Tee",
    status: "active",
    mediaRefs: ["https://cdn/img.jpg"],
    variants: [
      CatalogVariantView.create({
        externalVariantRef: ExternalRef.of("gid://v/1"),
        title: "Default",
        presentmentPrices: prices,
        inventory: InventorySnapshot.of(5, "deny", now),
      }),
    ],
  });
}

describe("PurchasableAssembler", () => {
  const assembler = new PurchasableAssembler(new PriceResolver(), new SellabilityPolicy(3600_000));

  it("assembles a sellable Purchasable from a priced view", () => {
    const p = assembler.assemble(
      product(true),
      product(true).variants[0],
      Market.of("US", "USD"),
      now,
    );
    expect(p.price?.amountMinor).toBe(1999);
    expect(p.sellability.isSellable()).toBe(true);
    expect(p.mediaRefs).toEqual(["https://cdn/img.jpg"]);
    expect(p.variantRef.toString()).toBe("gid://v/1");
  });

  it("marks an unpriced variant unavailable, never priced 0", () => {
    const prod = product(false);
    const p = assembler.assemble(prod, prod.variants[0], Market.of("US", "USD"), now);
    expect(p.price).toBeUndefined();
    expect(p.sellability.verdict).toBe("unavailable");
  });
});

describe("ErrorClassifier", () => {
  const classifier = new ErrorClassifier();

  it("classifies HTTP 429 as retryable throttling", () => {
    const e = classifier.fromHttp(429, { errors: "throttled" });
    expect(e.class).toBe(BackendErrorClass.Throttled);
    expect(e.retryable).toBe(true);
  });
  it("classifies HTTP 401 as permanent auth error", () => {
    const e = classifier.fromHttp(401, {});
    expect(e.class).toBe(BackendErrorClass.Auth);
    expect(e.retryable).toBe(false);
  });
  it("classifies userErrors as validation, permanent", () => {
    const e = classifier.fromUserErrors([{ field: ["email"], message: "bad" }]);
    expect(e.class).toBe(BackendErrorClass.Validation);
    expect(e.retryable).toBe(false);
  });
  it("classifies 5xx as retryable network", () => {
    const e = classifier.fromHttp(503, {});
    expect(e.class).toBe(BackendErrorClass.Network);
    expect(e.retryable).toBe(true);
  });
});
