import { describe, it, expect, vi } from "vitest";
import { Money } from "@/modules/shared-kernel/money";
import { Order } from "../domain/order";
import { OfferLineSnapshot, CustomerSnapshot } from "../domain/value-objects";
import { CreateOrderFromPaidSaleService } from "./create-order-from-paid-sale.service";
import type { OrderRepositoryPort, DomainEventPublisherPort, BrandingInfoPort } from "./ports";
import { EmitLifecycleEmailService } from "./emit-lifecycle-email.service";

const branding: BrandingInfoPort = {
  load: async () => ({ storeName: "S", storeUrl: "https://s.test", storeEmail: "s@s.test", storeLogo: "", timeZone: "UTC" }),
};

const captured = {
  saleRef: "sale_1",
  capturedTotalMinor: 10000,
  currencyCode: "USD",
  captureIdempotencyKey: "cap_abc",
  orderNumber: "1001",
  lines: [
    {
      externalRef: "v1",
      title: "Item",
      quantity: 1,
      unitPriceMinor: 10000,
      lineTotalMinor: 10000,
    },
  ],
  customer: { email: "a@b.co", name: "Ann" },
  backendOrderRef: undefined as string | undefined,
  attribution: { sessionId: "s1" },
};

function deps(existing: Order | null) {
  const saved: Order[] = [];
  const repo: OrderRepositoryPort = {
    findBySaleRef: async () => existing,
    findById: async () => null,
    findPaidWithBackendRef: async () => ({ orders: [], nextCursor: null }),
    save: async (o) => {
      saved.push(o);
    },
  };
  const published: string[] = [];
  const publisher: DomainEventPublisherPort = {
    publishAll: async (evs) => {
      published.push(...evs.map((e) => e.type));
    },
  };
  const send = vi.fn().mockResolvedValue(undefined);
  const email = new EmitLifecycleEmailService({ send }, async () => true, branding);
  return { repo, publisher, email, saved, published, send };
}

describe("CreateOrderFromPaidSaleService", () => {
  it("creates an Order at PAID, publishes OrderCreated, sends receipt", async () => {
    const { repo, publisher, email, saved, published, send } = deps(null);
    const svc = new CreateOrderFromPaidSaleService(repo, publisher, email, () => "ord_1");

    const created = await svc.handle(captured);

    expect(created).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0].state).toBe("PAID");
    expect(saved[0].capturedTotal.amountMinor).toBe(10000);
    expect(published).toEqual(["OrderCreated"]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].templateKey).toBe("order.receipt");
  });

  it("is idempotent when an Order already exists for the SaleRef", async () => {
    const existing = Order.createFromPaidSale({
      id: "ord_1",
      orderNumber: "1001",
      saleRef: "sale_1",
      capturedTotal: Money.of(10000, "USD"),
      lines: [
        OfferLineSnapshot.of({
          externalRef: "v1",
          title: "Item",
          quantity: 1,
          unitPrice: Money.of(10000, "USD"),
          lineTotal: Money.of(10000, "USD"),
        }),
      ],
      customer: CustomerSnapshot.of({ email: "a@b.co" }),
    });
    existing.pullEvents();
    const { repo, publisher, email, saved, send } = deps(existing);
    const svc = new CreateOrderFromPaidSaleService(repo, publisher, email, () => "ord_2");

    const created = await svc.handle(captured);

    expect(created).toBe(false);
    expect(saved).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });
});
