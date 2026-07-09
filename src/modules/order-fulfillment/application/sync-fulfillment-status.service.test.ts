import { describe, it, expect, vi } from "vitest";
import { Money } from "@/modules/shared-kernel/money";
import { Order } from "../domain/order";
import { OfferLineSnapshot, CustomerSnapshot, BackendOrderRef, RefundRecordRef } from "../domain/value-objects";
import { FulfillmentStatus } from "../domain/fulfillment-status";
import { TrackingInfo } from "../domain/tracking-info";
import { SyncFulfillmentStatusService } from "./sync-fulfillment-status.service";
import { MarkOrderDeliveredService } from "./mark-order-delivered.service";
import type {
  OrderRepositoryPort,
  BackendFulfillmentReaderPort,
  DomainEventPublisherPort,
  BrandingInfoPort,
} from "./ports";
import { EmitLifecycleEmailService } from "./emit-lifecycle-email.service";

const branding: BrandingInfoPort = {
  load: async () => ({ storeName: "S", storeUrl: "https://s.test", storeEmail: "s@s.test", storeLogo: "", timeZone: "UTC" }),
};

function paidOrder(backendRef = "gid://shopify/Order/1") {
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
    backendOrderRef: BackendOrderRef.of(backendRef),
  });
  o.pullEvents();
  return o;
}

function harness(order: Order, backend: { status: FulfillmentStatus; tracking?: TrackingInfo }) {
  const saved: Order[] = [];
  const repo: OrderRepositoryPort = {
    findBySaleRef: async () => order,
    findById: async () => order,
    findPaidWithBackendRef: async () => ({ orders: [order], nextCursor: null }),
    save: async (o) => { saved.push(o); },
  };
  const reader: BackendFulfillmentReaderPort = {
    readFulfillment: async () => ({ status: backend.status, tracking: backend.tracking }),
  };
  const published: string[] = [];
  const publisher: DomainEventPublisherPort = {
    publishAll: async (evs) => { published.push(...evs.map((e) => e.type)); },
  };
  const send = vi.fn().mockResolvedValue(undefined);
  const email = new EmitLifecycleEmailService({ send }, async () => true, branding);
  return { repo, reader, publisher, email, saved, published, send };
}

describe("SyncFulfillmentStatusService", () => {
  it("advances PAID → SHIPPED on in_transit + tracking, emits shipped email", async () => {
    const order = paidOrder();
    const h = harness(order, {
      status: FulfillmentStatus.IN_TRANSIT,
      tracking: TrackingInfo.of({ carrier: "ups", trackingNumber: "1Z" }),
    });
    const svc = new SyncFulfillmentStatusService(h.repo, h.reader, h.publisher, h.email);

    const result = await svc.sweep();

    expect(result).toEqual({ scanned: 1, advanced: 1 });
    expect(h.saved[0]!.state).toBe("SHIPPED");
    expect(h.published).toEqual(["OrderShipped"]);
    expect(h.send.mock.calls[0]![0].templateKey).toBe("order.shipped");
  });

  it("does not save or email when backend status is unknown", async () => {
    const order = paidOrder();
    const h = harness(order, { status: FulfillmentStatus.UNKNOWN });
    const svc = new SyncFulfillmentStatusService(h.repo, h.reader, h.publisher, h.email);

    const result = await svc.sweep();

    expect(result).toEqual({ scanned: 1, advanced: 0 });
    expect(h.saved).toHaveLength(0);
    expect(h.send).not.toHaveBeenCalled();
  });

  it("does not advance, save, or email when the order was refunded since the page query", async () => {
    const stalePaid = paidOrder();
    const refunded = paidOrder();
    refunded.recordRefund(RefundRecordRef.of({ transactionId: "rf_1", amount: Money.of(10000, "USD") }));
    refunded.pullEvents();
    expect(refunded.state).toBe("REFUNDED");

    const saved: Order[] = [];
    const repo: OrderRepositoryPort = {
      findBySaleRef: async () => refunded,
      findById: async () => refunded,
      findPaidWithBackendRef: async () => ({ orders: [stalePaid], nextCursor: null }),
      save: async (o) => { saved.push(o); },
    };
    const reader: BackendFulfillmentReaderPort = {
      readFulfillment: async () => ({
        status: FulfillmentStatus.IN_TRANSIT,
        tracking: TrackingInfo.of({ carrier: "ups", trackingNumber: "1Z" }),
      }),
    };
    const published: string[] = [];
    const publisher: DomainEventPublisherPort = {
      publishAll: async (evs) => { published.push(...evs.map((e) => e.type)); },
    };
    const send = vi.fn().mockResolvedValue(undefined);
    const email = new EmitLifecycleEmailService({ send }, async () => true, branding);
    const svc = new SyncFulfillmentStatusService(repo, reader, publisher, email);

    const result = await svc.sweep();

    expect(result).toEqual({ scanned: 1, advanced: 0 });
    expect(saved).toHaveLength(0);
    expect(published).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("SyncFulfillmentStatusService pagination & concurrency", () => {
  it("walks pages via the cursor until nextCursor is null and counts every page", async () => {
    const o1 = paidOrder("gid://shopify/Order/1");
    const o2 = paidOrder("gid://shopify/Order/2");
    const cursorSeen: Array<{ updatedAt: Date; id: string } | undefined> = [];
    const repo: OrderRepositoryPort = {
      findBySaleRef: async () => o1,
      findById: async () => o1,
      findPaidWithBackendRef: async (_limit, after) => {
        cursorSeen.push(after);
        if (!after) return { orders: [o1], nextCursor: { updatedAt: new Date(1000), id: "ord_1" } };
        return { orders: [o2], nextCursor: null };
      },
      save: async () => {},
    };
    const reader: BackendFulfillmentReaderPort = {
      readFulfillment: async () => ({ status: FulfillmentStatus.UNKNOWN, tracking: undefined }),
    };
    const publisher: DomainEventPublisherPort = { publishAll: async () => {} };
    const email = new EmitLifecycleEmailService({ send: vi.fn() }, async () => true, branding);
    const svc = new SyncFulfillmentStatusService(repo, reader, publisher, email);

    const result = await svc.sweep();

    expect(result.scanned).toBe(2);
    expect(cursorSeen).toEqual([undefined, { updatedAt: new Date(1000), id: "ord_1" }]);
  });

  it("caps in-flight reads at the concurrency bound", async () => {
    const orders = Array.from({ length: 30 }, (_, i) => paidOrder(`gid://shopify/Order/${i}`));
    const repo: OrderRepositoryPort = {
      findBySaleRef: async () => orders[0]!,
      findById: async () => orders[0]!,
      findPaidWithBackendRef: async (_limit, after) =>
        after ? { orders: [], nextCursor: null } : { orders, nextCursor: null },
      save: async () => {},
    };
    let inFlight = 0;
    let peak = 0;
    const reader: BackendFulfillmentReaderPort = {
      readFulfillment: async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return { status: FulfillmentStatus.UNKNOWN, tracking: undefined };
      },
    };
    const publisher: DomainEventPublisherPort = { publishAll: async () => {} };
    const email = new EmitLifecycleEmailService({ send: vi.fn() }, async () => true, branding);
    const svc = new SyncFulfillmentStatusService(repo, reader, publisher, email);

    const result = await svc.sweep();

    expect(result.scanned).toBe(30);
    expect(peak).toBeLessThanOrEqual(6);
    expect(peak).toBeGreaterThan(1);
  });
});

describe("MarkOrderDeliveredService", () => {
  it("advances PAID → DELIVERED and emits delivered email", async () => {
    const order = paidOrder();
    const h = harness(order, { status: FulfillmentStatus.UNKNOWN });
    const svc = new MarkOrderDeliveredService(h.repo, h.publisher, h.email);

    const out = await svc.execute("ord_1");

    expect(out).toEqual({ changed: true, state: "DELIVERED" });
    expect(h.send.mock.calls[0]![0].templateKey).toBe("order.delivered");
  });
});
