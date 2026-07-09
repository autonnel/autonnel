import { describe, it, expect } from "vitest";
import { OrderDashboardQueryService } from "./order-dashboard-query.service";
import type {
  OrderReadPort,
  OrderVisitReadPort,
  OrderEmailReadPort,
  OrderDetailView,
  OrderListItem,
  OrderListPage,
} from "./order-dashboard-read-model";

function detail(over: Partial<OrderDetailView> = {}): OrderDetailView {
  return {
    id: "ord_1",
    orderNumber: "1001",
    status: "PAID",
    saleRef: "sale_1",
    capturedTotalMinor: 10000,
    currencyCode: "USD",
    customerEmail: "a@b.co",
    customerName: "Ann",
    customerPhone: null,
    checkoutLanguage: null,
    lines: [],
    trackingCarrier: null,
    trackingNumber: null,
    trackingUrl: null,
    backendOrderRef: null,
    note: null,
    attribution: { sessionId: "sess_1" },
    contactChannel: null,
    contactNormalized: null,
    hashedIdentity: null,
    address: null,
    refunds: [],
    refundedMinor: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function fakeOrders(d: OrderDetailView | null): OrderReadPort {
  const item: OrderListItem = {
    id: "ord_1",
    orderNumber: "1001",
    status: "PAID",
    saleRef: "sale_1",
    capturedTotalMinor: 10000,
    currencyCode: "USD",
    customerEmail: "a@b.co",
    customerName: "Ann",
    trackingNumber: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const page: OrderListPage = { items: [item], total: 1, page: 1, limit: 30, totalPages: 1 };
  return {
    list: async () => page,
    detail: async () => d,
    forExport: async () => [item],
  };
}

const visitsPort: OrderVisitReadPort = {
  bySession: async (sessionId, limit) => ({
    visits: [{ url: `/p?s=${sessionId}`, kind: "PAGE_VIEW", occurredAt: "2026-01-01T00:00:00.000Z" }],
    total: limit,
  }),
};

const emailsPort: OrderEmailReadPort = {
  byOrder: async (orderId) => [
    {
      id: "d1",
      templateKey: "order.receipt",
      recipient: "a@b.co",
      subject: `Receipt ${orderId}`,
      status: "SENT",
      attemptCount: 1,
      lastError: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

describe("OrderDashboardQueryService", () => {
  it("clamps the list limit", async () => {
    const svc = new OrderDashboardQueryService(fakeOrders(detail()), visitsPort, emailsPort);
    const captured: number[] = [];
    const orders: OrderReadPort = {
      list: async (input) => {
        captured.push(input.limit);
        return { items: [], total: 0, page: input.page, limit: input.limit, totalPages: 0 };
      },
      detail: async () => null,
      forExport: async () => [],
    };
    await new OrderDashboardQueryService(orders, visitsPort, emailsPort).list({}, 1, 9999);
    await new OrderDashboardQueryService(orders, visitsPort, emailsPort).list({}, 1, 0);
    expect(captured).toEqual([500, 30]);
    void svc;
  });

  it("bundles detail with emails and session visits", async () => {
    const svc = new OrderDashboardQueryService(fakeOrders(detail()), visitsPort, emailsPort);
    const bundle = await svc.detail("ord_1");
    expect(bundle).not.toBeNull();
    expect(bundle!.order.orderNumber).toBe("1001");
    expect(bundle!.emails[0].subject).toBe("Receipt ord_1");
    expect(bundle!.visits).toHaveLength(1);
    expect(bundle!.visitsTotal).toBe(50);
  });

  it("returns empty visits when the order has no session attribution", async () => {
    const svc = new OrderDashboardQueryService(
      fakeOrders(detail({ attribution: null })),
      visitsPort,
      emailsPort,
    );
    const bundle = await svc.detail("ord_1");
    expect(bundle!.visits).toEqual([]);
    expect(bundle!.visitsTotal).toBe(0);
  });

  it("returns null detail for a missing order", async () => {
    const svc = new OrderDashboardQueryService(fakeOrders(null), visitsPort, emailsPort);
    expect(await svc.detail("missing")).toBeNull();
  });
});
