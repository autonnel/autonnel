import { describe, it, expect } from "vitest";
import { InventorySnapshot } from "./inventory-snapshot";
import { Sellability } from "./sellability";
import { CapabilityProfile } from "./capability-profile";
import { BackendError, BackendErrorClass } from "./backend-error";

describe("InventorySnapshot", () => {
  it("is stale when older than the TTL", () => {
    const now = new Date("2026-06-04T12:00:00Z");
    const old = new Date("2026-06-04T10:00:00Z");
    const snap = InventorySnapshot.of(5, "deny", old);
    expect(snap.isStale(now, 3600_000)).toBe(true);
    expect(snap.isStale(old, 3600_000)).toBe(false);
  });
  it("treats null available as unknown inventory", () => {
    const snap = InventorySnapshot.of(null, "unknown", new Date());
    expect(snap.isKnown()).toBe(false);
  });
});

describe("Sellability", () => {
  it("constructs explicit verdicts", () => {
    expect(Sellability.sellable().verdict).toBe("sellable");
    expect(Sellability.unavailable("price_unavailable").reason).toBe("price_unavailable");
    expect(Sellability.unknown("stale_inventory").verdict).toBe("unknown");
  });
  it("never silently asserts sellable", () => {
    expect(Sellability.unknown("stale_inventory").isSellable()).toBe(false);
  });
});

describe("CapabilityProfile", () => {
  it("exposes only normalized upstream flags and keeps handoffStrategy internal", () => {
    const p = CapabilityProfile.of({
      supportsPresentmentPricing: true,
      supportsRealtimeInventory: false,
      supportsExternalPaidOrder: true,
      supportsWebhooks: true,
      handoffStrategy: "orderCreate",
    });
    expect(p.upstreamFlags()).toEqual({ supportsMultiCurrency: true });
    expect(p.handoffStrategy).toBe("orderCreate");
  });
});

describe("BackendError", () => {
  it("classifies retryable vs permanent and hides vendorRaw from upstream flags", () => {
    const e = BackendError.of(BackendErrorClass.Throttled, true, { code: 429 });
    expect(e.retryable).toBe(true);
    expect(e.class).toBe(BackendErrorClass.Throttled);
  });
});
