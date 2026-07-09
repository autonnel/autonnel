import { describe, it, expect, vi } from "vitest";
import { WooCommerceOrderAdapter } from "./order-adapter";
import { Money } from "../../../../shared-kernel/money";
import type { HandoffOrderInput } from "../../../domain/services/handoff-translator";

function input(overrides: Partial<HandoffOrderInput> = {}): HandoffOrderInput {
  return {
    alreadyPaid: true,
    reauthorize: false,
    financialStatus: "paid",
    lines: [{ variantRef: "55", quantity: 2, unitPriceMinor: 1000, currencyCode: "USD" }],
    grandTotal: Money.of(2000, "USD"),
    customer: {
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      shippingAddress: { line1: "1 Main", city: "Town", region: "CA", countryCode: "US", postalCode: "90001" },
    },
    ...overrides,
  };
}

describe("WooCommerceOrderAdapter", () => {
  it("creates a paid order with a directly-resolved product line item", async () => {
    const request = vi.fn(async (method: string, path: string, _options?: unknown) => {
      if (method === "GET" && path === "/products/55") return { id: 55 };
      if (method === "POST" && path === "/orders") return { id: 9001 };
      throw new Error(`unexpected ${method} ${path}`);
    });
    const adapter = new WooCommerceOrderAdapter({ request } as any);
    const result = await adapter.createPaidOrder(input(), "key");

    expect(result.backendOrderRef.toString()).toBe("9001");
    const orderCall = request.mock.calls.find((c) => c[1] === "/orders")!;
    const body = (orderCall[2] as any).body;
    expect(body.set_paid).toBe(true);
    expect(body.currency).toBe("USD");
    expect(body.line_items).toEqual([{ product_id: 55, quantity: 2 }]);
    expect(body.billing).toMatchObject({ first_name: "Ada", last_name: "Lovelace", email: "ada@example.com", country: "US" });
  });

  it("falls back to resolving a variation when the ref is not a parent product", async () => {
    const request = vi.fn(async (method: string, path: string, _options?: unknown) => {
      if (method === "GET" && path === "/products/55") throw new Error("404");
      if (method === "GET" && path === "/products") return [{ id: 40, variations: [55] }];
      if (method === "POST" && path === "/orders") return { id: 9002 };
      throw new Error(`unexpected ${method} ${path}`);
    });
    const adapter = new WooCommerceOrderAdapter({ request } as any);
    const result = await adapter.createPaidOrder(input(), "key");

    expect(result.backendOrderRef.toString()).toBe("9002");
    const orderCall = request.mock.calls.find((c) => c[1] === "/orders")!;
    expect((orderCall[2] as any).body.line_items).toEqual([{ product_id: 40, variation_id: 55, quantity: 2 }]);
  });

  it("threads the idempotency key onto the order POST so a retry after local failure does not duplicate", async () => {
    const request = vi.fn(async (method: string, path: string, _options?: unknown) => {
      if (method === "GET" && path === "/products/55") return { id: 55 };
      if (method === "POST" && path === "/orders") return { id: 9003 };
      throw new Error(`unexpected ${method} ${path}`);
    });
    const adapter = new WooCommerceOrderAdapter({ request } as any);
    await adapter.createPaidOrder(input(), "tenant-1:sale-1");

    const orderCall = request.mock.calls.find((c) => c[1] === "/orders")!;
    expect((orderCall[2] as any).idempotencyKey).toBe("tenant-1:sale-1");
  });
});
