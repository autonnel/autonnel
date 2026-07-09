import { describe, it, expect } from "vitest";
import { PriceResolver } from "./price-resolver";
import { SellabilityPolicy } from "./sellability-policy";
import { PresentmentPriceMap } from "../value-objects/presentment-price";
import { InventorySnapshot } from "../value-objects/inventory-snapshot";
import { Market, DEFAULT_MARKET } from "../value-objects/market";
import { Money } from "../../../shared-kernel/money";

const usPrices = PresentmentPriceMap.from([
  { market: Market.of("US", "USD"), price: Money.of(1999, "USD") },
]);

describe("PriceResolver", () => {
  it("resolves the requested market price", () => {
    const r = new PriceResolver();
    expect(r.resolve(usPrices, Market.of("US", "USD"))?.amountMinor).toBe(1999);
  });
  it("falls back to the default market when the requested one is missing", () => {
    const r = new PriceResolver();
    expect(r.resolve(usPrices, Market.of("DE", "EUR"), DEFAULT_MARKET)?.amountMinor).toBe(1999);
  });
  it("returns undefined (price_unavailable) when nothing resolves", () => {
    const r = new PriceResolver();
    expect(r.resolve(PresentmentPriceMap.from([]), Market.of("US", "USD"))).toBeUndefined();
  });
});

describe("SellabilityPolicy", () => {
  const policy = new SellabilityPolicy(3600_000); // 1h inventory TTL
  const now = new Date("2026-06-04T12:00:00Z");

  it("is unavailable when price is missing", () => {
    const inv = InventorySnapshot.of(5, "deny", now);
    const s = policy.evaluate({ price: undefined, inventory: inv, now });
    expect(s.verdict).toBe("unavailable");
    expect(s.reason).toBe("price_unavailable");
  });
  it("is unknown when inventory is stale (never asserts in-stock)", () => {
    const stale = InventorySnapshot.of(5, "deny", new Date("2026-06-04T10:00:00Z"));
    const s = policy.evaluate({ price: Money.of(1999, "USD"), inventory: stale, now });
    expect(s.verdict).toBe("unknown");
    expect(s.reason).toBe("stale_inventory");
  });
  it("is unavailable when deny-policy stock is zero", () => {
    const inv = InventorySnapshot.of(0, "deny", now);
    const s = policy.evaluate({ price: Money.of(1999, "USD"), inventory: inv, now });
    expect(s.verdict).toBe("unavailable");
    expect(s.reason).toBe("out_of_stock");
  });
  it("is sellable when priced and in stock and fresh", () => {
    const inv = InventorySnapshot.of(5, "deny", now);
    const s = policy.evaluate({ price: Money.of(1999, "USD"), inventory: inv, now });
    expect(s.isSellable()).toBe(true);
  });
  it("is sellable with continue-policy even at zero stock", () => {
    const inv = InventorySnapshot.of(0, "continue", now);
    const s = policy.evaluate({ price: Money.of(1999, "USD"), inventory: inv, now });
    expect(s.isSellable()).toBe(true);
  });
});
