import { describe, it, expect } from "vitest";
import { ExternalRef } from "./external-ref";
import { Market, DEFAULT_MARKET } from "./market";
import { PresentmentPriceMap } from "./presentment-price";
import { Money } from "../../../shared-kernel/money";

describe("ExternalRef", () => {
  it("wraps an opaque token and exposes it via toString without parsing", () => {
    const ref = ExternalRef.of("gid://shopify/ProductVariant/123");
    expect(ref.toString()).toBe("gid://shopify/ProductVariant/123");
    expect(ref.equals(ExternalRef.of("gid://shopify/ProductVariant/123"))).toBe(true);
  });
  it("rejects an empty token", () => {
    expect(() => ExternalRef.of("")).toThrow();
  });
});

describe("Market", () => {
  it("normalizes country and currency to upper-case", () => {
    const m = Market.of("us", "usd");
    expect(m.countryCode).toBe("US");
    expect(m.currencyCode).toBe("USD");
    expect(m.key()).toBe("US:USD");
  });
  it("exposes a default market", () => {
    expect(DEFAULT_MARKET.key()).toBe("US:USD");
  });
});

describe("PresentmentPriceMap", () => {
  it("resolves a price for a market and returns undefined when absent", () => {
    const map = PresentmentPriceMap.from([
      { market: Market.of("US", "USD"), price: Money.of(1999, "USD") },
    ]);
    expect(map.resolve(Market.of("US", "USD"))?.amountMinor).toBe(1999);
    expect(map.resolve(Market.of("DE", "EUR"))).toBeUndefined();
    expect(map.isEmpty()).toBe(false);
  });
  it("reports empty when no prices supplied", () => {
    expect(PresentmentPriceMap.from([]).isEmpty()).toBe(true);
  });
  it("carries an optional compare-at price per market and resolves it by market and currency", () => {
    const map = PresentmentPriceMap.from([
      { market: Market.of("US", "USD"), price: Money.of(1999, "USD"), compareAtPrice: Money.of(2499, "USD") },
      { market: Market.of("DE", "EUR"), price: Money.of(1799, "EUR") },
    ]);
    expect(map.resolveCompare(Market.of("US", "USD"))?.amountMinor).toBe(2499);
    expect(map.resolveCompareByCurrency("USD")?.amountMinor).toBe(2499);
    expect(map.resolveCompare(Market.of("DE", "EUR"))).toBeUndefined();
    expect(map.firstCompare()?.amountMinor).toBe(2499);
  });
});
