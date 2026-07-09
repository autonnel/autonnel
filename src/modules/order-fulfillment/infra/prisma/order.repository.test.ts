import { describe, it, expect } from "vitest";
import { runWithTenant } from "@/lib/tenant/context";
import { Money } from "@/modules/shared-kernel/money";
import { Order } from "../../domain/order";
import { OrderLifecycleState } from "../../domain/order-lifecycle-state";
import { OfferLineSnapshot, CustomerSnapshot, RefundRecordRef, BackendOrderRef } from "../../domain/value-objects";
import { PrismaOrderRepository } from "./order.repository";

function orderInState(state: OrderLifecycleState, refunds: RefundRecordRef[] = []): Order {
  return Order.rehydrate({
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
    state,
    refunds,
    backendOrderRef: BackendOrderRef.of("gid://shopify/Order/1"),
  });
}

interface Row {
  id: string;
  status: string;
}

// Minimal stand-in that enforces the same WHERE semantics the guard relies on,
// so the test exercises the guard rather than the real Prisma engine.
function fakeDb(seed?: Row) {
  let row: Row | null = seed ? { ...seed } : null;
  const calls = { create: 0 };
  const db = {
    order: {
      async updateMany({ where, data }: { where: { id: string; status?: { notIn: string[] } }; data: Row }) {
        if (!row || row.id !== where.id) return { count: 0 };
        if (where.status?.notIn?.includes(row.status)) return { count: 0 };
        row = { ...row, ...data };
        return { count: 1 };
      },
      async findFirst({ where }: { where: { id: string } }) {
        return row && row.id === where.id ? { id: row.id } : null;
      },
      async create({ data }: { data: Row }) {
        calls.create++;
        row = { ...data };
        return row;
      },
    },
  };
  return { db: db as never, getRow: () => row, calls };
}

describe("PrismaOrderRepository.save refund guard", () => {
  it("does not regress a persisted refund state when a stale non-refund write arrives", async () => {
    const f = fakeDb({ id: "ord_1", status: OrderLifecycleState.REFUNDED });
    const repo = new PrismaOrderRepository(f.db);
    await runWithTenant("default", () => repo.save(orderInState(OrderLifecycleState.SHIPPED)));
    expect(f.getRow()!.status).toBe(OrderLifecycleState.REFUNDED);
    expect(f.calls.create).toBe(0);
  });

  it("applies a normal fulfillment advance to a non-refund row", async () => {
    const f = fakeDb({ id: "ord_1", status: OrderLifecycleState.PAID });
    const repo = new PrismaOrderRepository(f.db);
    await runWithTenant("default", () => repo.save(orderInState(OrderLifecycleState.SHIPPED)));
    expect(f.getRow()!.status).toBe(OrderLifecycleState.SHIPPED);
  });

  it("creates the row when it does not yet exist", async () => {
    const f = fakeDb();
    const repo = new PrismaOrderRepository(f.db);
    await runWithTenant("default", () => repo.save(orderInState(OrderLifecycleState.PAID)));
    expect(f.calls.create).toBe(1);
    expect(f.getRow()!.status).toBe(OrderLifecycleState.PAID);
  });

  it("allows a refund write to land on an already-refunded row (partial → full)", async () => {
    const f = fakeDb({ id: "ord_1", status: OrderLifecycleState.PARTIALLY_REFUNDED });
    const repo = new PrismaOrderRepository(f.db);
    const refunds = [RefundRecordRef.of({ transactionId: "rf_1", amount: Money.of(10000, "USD") })];
    await runWithTenant("default", () => repo.save(orderInState(OrderLifecycleState.REFUNDED, refunds)));
    expect(f.getRow()!.status).toBe(OrderLifecycleState.REFUNDED);
  });
});
