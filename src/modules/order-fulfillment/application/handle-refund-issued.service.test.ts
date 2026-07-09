import { describe, it, expect, vi } from "vitest";
import { Money } from "@/modules/shared-kernel/money";
import { Order } from "../domain/order";
import { OfferLineSnapshot, CustomerSnapshot } from "../domain/value-objects";
import { HandleRefundIssuedService } from "./handle-refund-issued.service";
import type { OrderRepositoryPort, DomainEventPublisherPort, BrandingInfoPort } from "./ports";
import { EmitLifecycleEmailService } from "./emit-lifecycle-email.service";

const branding: BrandingInfoPort = {
  load: async () => ({ storeName: "S", storeUrl: "https://s.test", storeEmail: "s@s.test", storeLogo: "", timeZone: "UTC" }),
};

function paidOrder() {
  const o = Order.createFromPaidSale({
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
  o.pullEvents();
  return o;
}

function deps(order: Order | null) {
  const saved: Order[] = [];
  const repo: OrderRepositoryPort = {
    findBySaleRef: async () => order,
    findById: async () => null,
    findPaidWithBackendRef: async () => ({ orders: [], nextCursor: null }),
    save: async (o) => { saved.push(o); },
  };
  const published: string[] = [];
  const publisher: DomainEventPublisherPort = {
    publishAll: async (evs) => { published.push(...evs.map((e) => e.type)); },
  };
  const send = vi.fn().mockResolvedValue(undefined);
  const email = new EmitLifecycleEmailService({ send }, async () => true, branding);
  return { repo, publisher, email, saved, published, send };
}

const fact = {
  saleRef: "sale_1",
  refundTransactionId: "txn_1",
  refundedAmountMinor: 3000,
  currencyCode: "USD",
};

describe("HandleRefundIssuedService", () => {
  it("records a partial refund, advances state, publishes + emails", async () => {
    const order = paidOrder();
    const { repo, publisher, email, saved, published, send } = deps(order);
    const svc = new HandleRefundIssuedService(repo, publisher, email);

    await svc.handle(fact);

    expect(saved[0]!.state).toBe("PARTIALLY_REFUNDED");
    expect(published).toEqual(["OrderRefunded"]);
    expect(send.mock.calls[0]![0].templateKey).toBe("order.refunded");
  });

  it("is idempotent on the same refund transaction id (no email)", async () => {
    const order = paidOrder();
    const { repo, send } = deps(order);
    const svc = new HandleRefundIssuedService(
      repo,
      { publishAll: async () => {} },
      new EmitLifecycleEmailService({ send }, async () => true, branding),
    );

    await svc.handle(fact);
    send.mockClear();
    await svc.handle(fact);

    expect(send).not.toHaveBeenCalled();
  });

  it("no-ops when no order exists for the SaleRef", async () => {
    const { repo, saved, send } = deps(null);
    const svc = new HandleRefundIssuedService(
      repo,
      { publishAll: async () => {} },
      new EmitLifecycleEmailService({ send }, async () => true, branding),
    );
    await svc.handle(fact);
    expect(saved).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });
});
