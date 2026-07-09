import { describe, it, expect } from "vitest";
import { generateOrderNumber } from "./order-number-generator";

describe("generateOrderNumber", () => {
  it("is numeric and prefix-free", () => {
    const n = generateOrderNumber(1_700_000_000_000, 0.4242);
    expect(n).toMatch(/^\d+$/);
  });

  it("is time-sortable (later capture -> larger number)", () => {
    const earlier = generateOrderNumber(1_700_000_000_000, 0);
    const later = generateOrderNumber(1_700_000_060_000, 0);
    expect(Number(later)).toBeGreaterThan(Number(earlier));
  });

  it("pads the random suffix to keep a stable width", () => {
    expect(generateOrderNumber(1_700_000_000_000, 0.001).endsWith("001")).toBe(true);
  });
});
