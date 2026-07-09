import { describe, it, expect } from "vitest";
import { IdempotencyKey } from "./idempotency-key";

describe("IdempotencyKey", () => {
  it("normalizes (trim) the token", () => {
    expect(IdempotencyKey.of("  abc  ").value).toBe("abc");
  });

  it("rejects empty tokens", () => {
    expect(() => IdempotencyKey.of("   ")).toThrow(/empty/i);
  });

  it("derives a stable key from parts", () => {
    const a = IdempotencyKey.derive("tenant", "sale", "123");
    const b = IdempotencyKey.derive("tenant", "sale", "123");
    expect(a.value).toBe(b.value);
    expect(a.value).not.toBe(IdempotencyKey.derive("tenant", "sale", "124").value);
  });

  it("constant-time compares equal and unequal keys", () => {
    const k = IdempotencyKey.of("same");
    expect(k.matches(IdempotencyKey.of("same"))).toBe(true);
    expect(k.matches(IdempotencyKey.of("other"))).toBe(false);
    // different length must not throw and must be false
    expect(k.matches(IdempotencyKey.of("longer-value"))).toBe(false);
  });
});
