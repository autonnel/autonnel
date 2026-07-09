import { describe, it, expect } from "vitest";
import { HandoffTranslator } from "./handoff-translator";
import { CapabilityProfile } from "../value-objects/capability-profile";
import { Money } from "../../../shared-kernel/money";
import { HandoffTotalMismatchError } from "../errors";

const orderCreateProfile = CapabilityProfile.of({
  supportsPresentmentPricing: true,
  supportsRealtimeInventory: true,
  supportsExternalPaidOrder: true,
  supportsWebhooks: true,
  handoffStrategy: "orderCreate",
});

const draftProfile = CapabilityProfile.of({
  supportsPresentmentPricing: true,
  supportsRealtimeInventory: true,
  supportsExternalPaidOrder: false,
  supportsWebhooks: true,
  handoffStrategy: "draftOrderComplete",
});

const lines = [
  { variantRef: "gid://v/1", quantity: 2, unitPriceMinor: 1000, currencyCode: "USD" },
];

describe("HandoffTranslator", () => {
  const translator = new HandoffTranslator();

  it("always requests the backend order as already-paid (financialStatus paid, no capture)", () => {
    const input = translator.toBackendInput({
      profile: orderCreateProfile,
      lines,
      capturedTotal: Money.of(2000, "USD"),
      customer: { email: "a@b.co" },
      appliedDiscount: undefined,
    });
    expect(input.alreadyPaid).toBe(true);
    expect(input.reauthorize).toBe(false);
    expect(input.financialStatus).toBe("paid");
  });

  it("enforces capturedTotal == grandTotal (no discount)", () => {
    const input = translator.toBackendInput({
      profile: orderCreateProfile,
      lines,
      capturedTotal: Money.of(2000, "USD"),
      customer: { email: "a@b.co" },
      appliedDiscount: undefined,
    });
    expect(input.grandTotal.amountMinor).toBe(2000);
  });

  it("throws when a coupon would break captured == grandTotal reconciliation", () => {
    expect(() =>
      translator.toBackendInput({
        profile: orderCreateProfile,
        lines,
        capturedTotal: Money.of(1500, "USD"),
        customer: { email: "a@b.co" },
        // 500 discount must reconcile: lineSubtotal(2000) - 500 == capturedTotal(1500). Here we pass 300.
        appliedDiscount: { amountMinor: 300, currencyCode: "USD", code: "SAVE" },
      }),
    ).toThrow(HandoffTotalMismatchError);
  });

  it("represents the funnel coupon as an order-level discount for orderCreate backends", () => {
    const input = translator.toBackendInput({
      profile: orderCreateProfile,
      lines,
      capturedTotal: Money.of(1500, "USD"),
      customer: { email: "a@b.co" },
      appliedDiscount: { amountMinor: 500, currencyCode: "USD", code: "SAVE" },
    });
    expect(input.discount?.scope).toBe("order");
    expect(input.discount?.amountMinor).toBe(500);
    expect(input.grandTotal.amountMinor).toBe(1500);
  });

  it("passes through parent tags onto the backend order input", () => {
    const input = translator.toBackendInput({
      profile: orderCreateProfile,
      lines,
      capturedTotal: Money.of(2000, "USD"),
      customer: { email: "a@b.co" },
      tags: ["autonnel:parent:A100"],
    });
    expect(input.tags).toEqual(["autonnel:parent:A100"]);
  });

  it("omits tags when none are supplied", () => {
    const input = translator.toBackendInput({
      profile: orderCreateProfile,
      lines,
      capturedTotal: Money.of(2000, "USD"),
      customer: { email: "a@b.co" },
    });
    expect(input.tags).toBeUndefined();
  });

  it("represents the funnel coupon as proportional line-item reductions for draftOrder backends", () => {
    const input = translator.toBackendInput({
      profile: draftProfile,
      lines,
      capturedTotal: Money.of(1500, "USD"),
      customer: { email: "a@b.co" },
      appliedDiscount: { amountMinor: 500, currencyCode: "USD", code: "SAVE" },
    });
    expect(input.discount?.scope).toBe("line_item");
    expect(input.grandTotal.amountMinor).toBe(1500);
  });
});
