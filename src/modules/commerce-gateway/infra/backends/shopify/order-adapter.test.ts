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

describe("ShopifyOrderAdapter", () => {
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
