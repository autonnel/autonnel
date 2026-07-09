import { describe, it, expect } from "vitest";
import { Money } from "./money";

describe("Money", () => {
  it("constructs from minor units + ISO-4217 code", () => {
    const m = Money.of(1099, "USD");
    expect(m.amountMinor).toBe(1099);
    expect(m.currencyCode).toBe("USD");
  });

  it("rejects non-integer minor units (no float drift)", () => {
    expect(() => Money.of(10.5, "USD")).toThrow(/integer/i);
  });

  it("rejects malformed currency codes", () => {
    expect(() => Money.of(100, "us")).toThrow(/ISO-4217/i);
  });

  it("adds same-currency amounts", () => {
    expect(Money.of(100, "USD").add(Money.of(50, "USD")).amountMinor).toBe(150);
  });

  it("throws on cross-currency arithmetic", () => {
    expect(() => Money.of(100, "USD").add(Money.of(50, "EUR"))).toThrow(/currency/i);
  });

  it("subtract and equals work", () => {
    expect(Money.of(100, "USD").subtract(Money.of(40, "USD")).amountMinor).toBe(60);
    expect(Money.of(100, "USD").equals(Money.of(100, "USD"))).toBe(true);
    expect(Money.of(100, "USD").equals(Money.of(100, "EUR"))).toBe(false);
  });
});
