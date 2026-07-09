import { describe, it, expect } from "vitest";
import { detectPriceMismatches } from "./make-event-delivery";

const line = (ref: string, unitPriceMinor: number, title = ref) => ({ variantExternalId: ref, title, unitPriceMinor });

describe("detectPriceMismatches", () => {
  it("returns no mismatch when live equals charged", () => {
    const out = detectPriceMismatches([line("v1", 1999), line("v2", 500)], new Map([["v1", 1999], ["v2", 500]]));
    expect(out).toEqual([]);
  });

  it("flags a line whose live price drifted from the charged price", () => {
    const out = detectPriceMismatches([line("v1", 1999, "Tee")], new Map([["v1", 2499]]));
    expect(out).toEqual([{ ref: "v1", title: "Tee", paidMinor: 1999, liveMinor: 2499 }]);
  });

  it("skips lines whose live price is unresolvable (removed / beyond cap)", () => {
    const out = detectPriceMismatches([line("v1", 1999), line("gone", 999)], new Map([["v1", 1999], ["gone", undefined]]));
    expect(out).toEqual([]);
  });

  it("flags only the drifted lines in a mixed cart", () => {
    const out = detectPriceMismatches(
      [line("ok", 1000), line("bad", 1000, "Mug"), line("missing", 700)],
      new Map([["ok", 1000], ["bad", 1500], ["missing", undefined]]),
    );
    expect(out).toEqual([{ ref: "bad", title: "Mug", paidMinor: 1000, liveMinor: 1500 }]);
  });
});
