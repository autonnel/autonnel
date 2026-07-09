import { describe, it, expect } from "vitest";
import { Money } from "@/modules/shared-kernel/money";
import { Order } from "../domain/order";
import { OfferLineSnapshot, CustomerSnapshot, BackendOrderRef } from "../domain/value-objects";
import { AttachBackendRefService } from "./attach-backend-ref.service";
import type { OrderRepositoryPort } from "./ports";

function paidOrder(): Order {
  return Order.createFromPaidSale({
    id: "ord_1",
    orderNumber: "12345678",
    saleRef: "sale_1",
    capturedTotal: Money.of(10000, "USD"),
    lines: [OfferLineSnapshot.of({ externalRef: "v1", title: "Item", quantity: 1, unitPrice: Money.of(10000, "USD"), lineTotal: Money.of(10000, "USD") })],
    customer: CustomerSnapshot.of({ email: "a@b.co" }),
  });
}

function repoWith(order: Order | null) {
  const saved: Order[] = [];
  const repo: OrderRepositoryPort = {
    findBySaleRef: async () => order,
    findById: async () => null,
    findPaidWithBackendRef: async () => ({ orders: [], nextCursor: null }),
    save: async (o) => { saved.push(o); },
  };
  return { repo, saved };
}

describe("AttachBackendRefService", () => {
  it("enriches an existing order with the backend ref", async () => {
    const order = paidOrder();
    const { repo, saved } = repoWith(order);
    await new AttachBackendRefService(repo).handle("sale_1", "gid://shopify/Order/99");
    expect(saved).toHaveLength(1);
    expect(saved[0].backendOrderRef?.value).toBe("gid://shopify/Order/99");
  });

  it("is idempotent when the ref is already attached", async () => {
    const order = paidOrder();
    order.backendOrderRef = BackendOrderRef.of("gid://shopify/Order/99");
    const { repo, saved } = repoWith(order);
    await new AttachBackendRefService(repo).handle("sale_1", "gid://shopify/Order/99");
    expect(saved).toHaveLength(0);
  });

  it("no-ops (does not throw) when the order does not exist yet", async () => {
    const { repo, saved } = repoWith(null);
    await new AttachBackendRefService(repo).handle("sale_x", "gid://shopify/Order/1");
    expect(saved).toHaveLength(0);
  });
});
