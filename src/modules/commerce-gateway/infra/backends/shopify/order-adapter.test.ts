import { describe, it, expect, vi } from "vitest";
import { ShopifyOrderAdapter } from "./order-adapter";
import type { HandoffOrderInput } from "../../../domain/services/handoff-translator";
import { Money } from "../../../../shared-kernel/money";

const input: HandoffOrderInput = {
  alreadyPaid: true,
  reauthorize: false,
  financialStatus: "paid",
  lines: [{ variantRef: "gid://shopify/ProductVariant/11", quantity: 2, unitPriceMinor: 1000, currencyCode: "USD" }],
  grandTotal: Money.of(2000, "USD"),
  customer: { email: "a@b.co" },
};

const eurInput: HandoffOrderInput = {
  ...input,
  lines: [{ variantRef: "gid://shopify/ProductVariant/11", quantity: 1, unitPriceMinor: 950, currencyCode: "EUR" }],
  grandTotal: Money.of(950, "EUR"),
};

const discountedInput: HandoffOrderInput = {
  ...eurInput,
  lines: [{ variantRef: "gid://shopify/ProductVariant/11", quantity: 2, unitPriceMinor: 950, currencyCode: "EUR" }],
  discount: { scope: "order", amountMinor: 300, currencyCode: "EUR", code: "SAVE3" },
  grandTotal: Money.of(1600, "EUR"),
};

describe("ShopifyOrderAdapter", () => {
  it("sends the order discount on orderCreate", async () => {
    const query = vi.fn(async (_query: string, _variables: unknown) => ({
      orderCreate: { order: { id: "gid://shopify/Order/9" }, userErrors: [] },
    }));
    const adapter = new ShopifyOrderAdapter({ query } as any, { disableNotifications: true });
    await adapter.createPaidOrder(discountedInput, "k");
    const order = (query.mock.calls[0]![1] as any).order;
    expect(order.lineItems[0].quantity).toBe(2);
    expect(order.discountCode).toEqual({
      orderFixedDiscountCode: { code: "SAVE3", amountSet: { shopMoney: { amount: "3.00", currencyCode: "EUR" } } },
    });
  });

  it("sends the order discount as appliedDiscount on the draft path", async () => {
    const query = vi.fn(async (q: string, _variables: unknown) =>
      q.includes("draftOrderCreate")
        ? { draftOrderCreate: { draftOrder: { id: "gid://shopify/DraftOrder/1" }, userErrors: [] } }
        : { draftOrderComplete: { draftOrder: { order: { id: "gid://shopify/Order/9" } }, userErrors: [] } },
    );
    const adapter = new ShopifyOrderAdapter({ query } as any, { disableNotifications: false });
    await adapter.createPaidOrder(discountedInput, "k");
    const draft = (query.mock.calls[0]![1] as any).input;
    expect(draft.appliedDiscount).toEqual({ value: 3, valueType: "FIXED_AMOUNT", title: "SAVE3" });
  });

  it("omits discount fields when there is no discount", async () => {
    const query = vi.fn(async (_query: string, _variables: unknown) => ({
      orderCreate: { order: { id: "gid://shopify/Order/9" }, userErrors: [] },
    }));
    const adapter = new ShopifyOrderAdapter({ query } as any, { disableNotifications: true });
    await adapter.createPaidOrder(eurInput, "k");
    expect((query.mock.calls[0]![1] as any).order.discountCode).toBeUndefined();
  });

  it("sends the session currency and charged unit price on orderCreate", async () => {
    const query = vi.fn(async (_query: string, _variables: unknown) => ({
      orderCreate: { order: { id: "gid://shopify/Order/9" }, userErrors: [] },
    }));
    const adapter = new ShopifyOrderAdapter({ query } as any, { disableNotifications: true });
    await adapter.createPaidOrder(eurInput, "k");
    const order = (query.mock.calls[0]![1] as any).order;
    expect(order.currency).toBe("EUR");
    expect(order.lineItems[0].priceSet.shopMoney).toEqual({ amount: "9.50", currencyCode: "EUR" });
  });

  it("sends presentment currency and original unit price on the draft path", async () => {
    const query = vi.fn(async (q: string, _variables: unknown) =>
      q.includes("draftOrderCreate")
        ? { draftOrderCreate: { draftOrder: { id: "gid://shopify/DraftOrder/1" }, userErrors: [] } }
        : { draftOrderComplete: { draftOrder: { order: { id: "gid://shopify/Order/9" } }, userErrors: [] } },
    );
    const adapter = new ShopifyOrderAdapter({ query } as any, { disableNotifications: false });
    await adapter.createPaidOrder(eurInput, "k");
    const draft = (query.mock.calls[0]![1] as any).input;
    expect(draft.presentmentCurrencyCode).toBe("EUR");
    expect(draft.lineItems[0].originalUnitPriceWithCurrency).toEqual({ amount: "9.50", currencyCode: "EUR" });
  });

  it("uses orderCreate with sendReceipt:false when notifications are disabled", async () => {
    const query = vi.fn(async (_query: string, _variables: unknown) => ({
      orderCreate: { order: { id: "gid://shopify/Order/9" }, userErrors: [] },
    }));
    const adapter = new ShopifyOrderAdapter({ query } as any, { disableNotifications: true });
    const result = await adapter.createPaidOrder(input, "tenant-1:sale-1");
    expect(result.backendOrderRef.toString()).toBe("gid://shopify/Order/9");
    const variables = query.mock.calls[0]![1] as any;
    expect(variables.order.financialStatus).toBe("PAID");
    expect(variables.options?.sendReceipt).toBe(false);
  });

  it("sends the buyer email and shipping address so the backend order can be fulfilled", async () => {
    const query = vi.fn(async (_query: string, _variables: unknown) => ({
      orderCreate: { order: { id: "gid://shopify/Order/9" }, userErrors: [] },
    }));
    const adapter = new ShopifyOrderAdapter({ query } as any, { disableNotifications: true });
    const customer = {
      fullName: "Ada King Lovelace",
      email: "ada@example.com",
      shippingAddress: { line1: "350 5th Ave", line2: "Fl 2", city: "New York", region: "NY", postalCode: "10118", countryCode: "US" },
    };
    await adapter.createPaidOrder({ ...input, customer }, "k");
    const order = (query.mock.calls[0]![1] as any).order;
    const expected = { firstName: "Ada King", lastName: "Lovelace", address1: "350 5th Ave", address2: "Fl 2", city: "New York", provinceCode: "NY", zip: "10118", countryCode: "US" };
    expect(order.email).toBe("ada@example.com");
    expect(order.shippingAddress).toEqual(expected);
    expect(order.billingAddress).toEqual(expected);
  });

  it("omits the address when the buyer has none and keeps a phone-only buyer email-less", async () => {
    const query = vi.fn(async (_query: string, _variables: unknown) => ({
      orderCreate: { order: { id: "gid://shopify/Order/9" }, userErrors: [] },
    }));
    const adapter = new ShopifyOrderAdapter({ query } as any, { disableNotifications: true });
    await adapter.createPaidOrder({ ...input, customer: { fullName: "Ada" } }, "k");
    const order = (query.mock.calls[0]![1] as any).order;
    expect(order.email).toBeUndefined();
    expect(order.shippingAddress).toBeUndefined();
  });

  it("applies parent tags on the orderCreate input when present", async () => {
    const query = vi.fn(async (_query: string, _variables: unknown) => ({
      orderCreate: { order: { id: "gid://shopify/Order/9" }, userErrors: [] },
    }));
    const adapter = new ShopifyOrderAdapter({ query } as any, { disableNotifications: true });
    await adapter.createPaidOrder({ ...input, tags: ["autonnel:parent:A100"] }, "k");
    const variables = query.mock.calls[0]![1] as any;
    expect(variables.order.tags).toEqual(["autonnel:parent:A100"]);
  });

  it("applies parent tags on the draftOrder input when notifications are enabled", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ draftOrderCreate: { draftOrder: { id: "gid://draft/1" }, userErrors: [] } })
      .mockResolvedValueOnce({ draftOrderComplete: { draftOrder: { order: { id: "gid://shopify/Order/9" } }, userErrors: [] } });
    const adapter = new ShopifyOrderAdapter({ query } as any, { disableNotifications: false });
    await adapter.createPaidOrder({ ...input, tags: ["autonnel:parent:A100"] }, "k");
    const variables = query.mock.calls[0]![1] as any;
    expect(variables.input.tags).toEqual(["autonnel:parent:A100"]);
    expect(variables.input.email).toBe("a@b.co");
  });

  it("throws a validation BackendError when Shopify returns userErrors", async () => {
    const query = vi.fn(async (_query: string, _variables: unknown) => ({
      orderCreate: { order: null, userErrors: [{ field: ["email"], message: "bad" }] },
    }));
    const adapter = new ShopifyOrderAdapter({ query } as any, { disableNotifications: true });
    await expect(adapter.createPaidOrder(input, "k")).rejects.toMatchObject({ name: "BackendError" });
  });

  it("falls back to draftOrderCreate+complete when notifications are enabled", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ draftOrderCreate: { draftOrder: { id: "gid://draft/1" }, userErrors: [] } })
      .mockResolvedValueOnce({ draftOrderComplete: { draftOrder: { order: { id: "gid://shopify/Order/9" } }, userErrors: [] } });
    const adapter = new ShopifyOrderAdapter({ query } as any, { disableNotifications: false });
    const result = await adapter.createPaidOrder(input, "k");
    expect(result.backendOrderRef.toString()).toBe("gid://shopify/Order/9");
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("threads the idempotency key to orderCreate so a local-persist-failure retry does not duplicate", async () => {
    const query = vi.fn(async (_query: string, _variables: unknown, _idem?: string) => ({
      orderCreate: { order: { id: "gid://shopify/Order/9" }, userErrors: [] },
    }));
    const adapter = new ShopifyOrderAdapter({ query } as any, { disableNotifications: true });
    await adapter.createPaidOrder(input, "tenant-1:sale-1");
    expect(query.mock.calls[0]![2]).toBe("tenant-1:sale-1");
  });

  it("threads the idempotency key to both draftOrder calls", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ draftOrderCreate: { draftOrder: { id: "gid://draft/1" }, userErrors: [] } })
      .mockResolvedValueOnce({ draftOrderComplete: { draftOrder: { order: { id: "gid://shopify/Order/9" } }, userErrors: [] } });
    const adapter = new ShopifyOrderAdapter({ query } as any, { disableNotifications: false });
    await adapter.createPaidOrder(input, "tenant-1:sale-1");
    expect(query.mock.calls[0]![2]).toBe("tenant-1:sale-1");
    expect(query.mock.calls[1]![2]).toBe("tenant-1:sale-1");
  });
});
