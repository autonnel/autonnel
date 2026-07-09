import { describe, it, expect } from "vitest";
import { Money } from "@/modules/shared-kernel/money";
import {
  OfferLineSnapshot,
  RefundRecordRef,
  BackendOrderRef,
  CustomerSnapshot,
} from "./value-objects";

describe("Order & Fulfillment value objects", () => {
  it("OfferLineSnapshot is an immutable priced line referencing catalog by ExternalRef only", () => {
    const line = OfferLineSnapshot.of({
      externalRef: "gid://shopify/ProductVariant/42",
      title: "Widget",
      quantity: 2,
      unitPrice: Money.of(1999, "USD"),
      lineTotal: Money.of(3998, "USD"),
    });
    expect(line.externalRef).toBe("gid://shopify/ProductVariant/42");
    expect(line.lineTotal.amountMinor).toBe(3998);
    expect(Object.isFrozen(line)).toBe(true);
  });

  it("RefundRecordRef links to a Payments Transaction(REFUND) with an amount", () => {
    const r = RefundRecordRef.of({ transactionId: "txn_1", amount: Money.of(500, "USD") });
    expect(r.transactionId).toBe("txn_1");
    expect(r.amount.amountMinor).toBe(500);
  });

  it("BackendOrderRef wraps an opaque ExternalRef", () => {
    const b = BackendOrderRef.of("gid://shopify/Order/9001");
    expect(b.value).toBe("gid://shopify/Order/9001");
  });

  it("CustomerSnapshot freezes buyer contact for the mirror", () => {
    const c = CustomerSnapshot.of({ email: "a@b.co", name: "Ann", phone: undefined });
    expect(c.email).toBe("a@b.co");
    expect(Object.isFrozen(c)).toBe(true);
  });
});
