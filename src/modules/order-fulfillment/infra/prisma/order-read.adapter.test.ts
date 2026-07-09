import { describe, it, expect } from "vitest";
import { PrismaOrderReadAdapter } from "./order-read.adapter";
import type { OrderRow } from "./order-mapper";

function row(over: Partial<OrderRow & { createdAt: Date }> = {}): OrderRow & { createdAt: Date } {
  return {
    id: "ord_1",
    tenantId: "t1",
    orderNumber: "1001",
    saleRef: "sale_1",
    status: "PAID",
    capturedTotal: 10000,
    currencyCode: "USD",
    customerEmail: "a@b.co",
    customerName: "Ann",
    customerPhone: null,
    checkoutLanguage: null,
    lines: [
      { externalRef: "v1", title: "Item", quantity: 2, unitPriceMinor: 5000, lineTotalMinor: 10000 },
    ],
    trackingCarrier: "ups",
    trackingNumber: "1Z",
    trackingUrl: "u",
    refunds: [{ transactionId: "t1", amountMinor: 500 }],
    backendOrderRef: "gid://o/1",
    attribution: { sessionId: "sess_1" },
    note: "vip",
    contactChannel: "email",
    contactNormalized: "a@b.co",
    hashedIdentity: "h_1",
    address: { line1: "1 St", city: "X", countryCode: "US", postalCode: "00000" },
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    ...over,
  };
}

function fakeDb(rows: Array<OrderRow & { createdAt: Date }>) {
  return {
    captured: { whereList: null as unknown, whereCount: null as unknown },
    order: {
      findMany: async (args: { where: unknown }) => rows,
      findUnique: async (args: { where: { id: string } }) =>
        rows.find((r) => r.id === args.where.id) ?? null,
      count: async (args: { where: unknown }) => rows.length,
    },
  };
}

describe("PrismaOrderReadAdapter", () => {
  it("maps a list page with pagination metadata", async () => {
    const db = fakeDb([row()]);
    const adapter = new PrismaOrderReadAdapter(db as never);
    const page = await adapter.list({ filters: {}, page: 1, limit: 30 });
    expect(page.total).toBe(1);
    expect(page.totalPages).toBe(1);
    expect(page.items[0]).toMatchObject({
      orderNumber: "1001",
      capturedTotalMinor: 10000,
      customerEmail: "a@b.co",
      trackingNumber: "1Z",
    });
    expect(page.items[0].createdAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("projects detail with lines, refunds, note and attribution", async () => {
    const adapter = new PrismaOrderReadAdapter(fakeDb([row()]) as never);
    const detail = await adapter.detail("ord_1");
    expect(detail).not.toBeNull();
    expect(detail!.lines).toHaveLength(1);
    expect(detail!.lines[0].lineTotalMinor).toBe(10000);
    expect(detail!.refunds[0].amountMinor).toBe(500);
    expect(detail!.refundedMinor).toBe(500);
    expect(detail!.note).toBe("vip");
    expect(detail!.attribution?.sessionId).toBe("sess_1");
  });

  it("returns null for an unknown order id", async () => {
    const adapter = new PrismaOrderReadAdapter(fakeDb([row()]) as never);
    expect(await adapter.detail("missing")).toBeNull();
  });

  it("builds a status + search filter where clause", async () => {
    let capturedWhere: Record<string, unknown> | null = null;
    const db = {
      order: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where;
          return [] as never;
        },
        findUnique: async () => null,
        count: async () => 0,
      },
    };
    const adapter = new PrismaOrderReadAdapter(db as never);
    await adapter.list({ filters: { status: ["PAID", "SHIPPED"], search: "ann" }, page: 1, limit: 10 });
    expect(capturedWhere).toMatchObject({ status: { in: ["PAID", "SHIPPED"] } });
    expect((capturedWhere as unknown as { OR: unknown[] }).OR).toHaveLength(2);
  });
});
