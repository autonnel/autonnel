import type { PrismaClient } from "@prisma/client";
import type { Order } from "../../domain/order";
import type { OrderRepositoryPort, OrderCursor, PaidOrdersPage } from "../../application/ports";
import type { SaleRef } from "../../domain/value-objects";
import { getCurrentTenantId } from "@/lib/tenant/context";
import { OrderLifecycleState, isRefundState } from "../../domain/order-lifecycle-state";
import { toPrisma, toDomain } from "./order-mapper";
import type { OrderRow } from "./order-mapper";

const REFUND_STATES = [OrderLifecycleState.PARTIALLY_REFUNDED, OrderLifecycleState.REFUNDED];

// tenantId is auto-injected by the Prisma extension on where/create;
// getCurrentTenantId() is used only to stamp the row on the explicit write payload.
export class PrismaOrderRepository implements OrderRepositoryPort {
  constructor(private readonly db: PrismaClient) {}

  async findBySaleRef(saleRef: SaleRef): Promise<Order | null> {
    const row = await this.db.order.findFirst({ where: { saleRef } });
    return row ? toDomain(row as unknown as OrderRow) : null;
  }

  async findById(orderId: string): Promise<Order | null> {
    const row = await this.db.order.findUnique({ where: { id: orderId } });
    return row ? toDomain(row as unknown as OrderRow) : null;
  }

  // Keyset pagination on (updatedAt, id) so each sweep advances past already-synced rows instead of
  // re-scanning the oldest page; a stable secondary id key breaks updatedAt ties deterministically.
  async findPaidWithBackendRef(limit: number, after?: OrderCursor): Promise<PaidOrdersPage> {
    const cursorWhere = after
      ? {
          OR: [
            { updatedAt: { gt: after.updatedAt } },
            { updatedAt: after.updatedAt, id: { gt: after.id } },
          ],
        }
      : {};
    const rows = await this.db.order.findMany({
      where: { status: { in: ["PAID", "SHIPPED"] }, backendOrderRef: { not: null }, ...cursorWhere },
      take: limit,
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    });
    const orders = rows.map((r) => toDomain(r as unknown as OrderRow));
    const last = rows[rows.length - 1] as { id: string; updatedAt: Date } | undefined;
    const nextCursor = rows.length === limit && last ? { updatedAt: last.updatedAt, id: last.id } : null;
    return { orders, nextCursor };
  }

  // A writer working from a stale snapshot (e.g. the fulfillment sync cron) must never regress a
  // refund that landed concurrently: when the persisted row is already in a refund state, only a
  // write that itself carries a refund state may touch it. updateMany's WHERE is the atomic guard.
  async save(order: Order): Promise<void> {
    const row = toPrisma(order, getCurrentTenantId());
    const { id, tenantId: _tenantId, ...rest } = row;
    const guard = isRefundState(order.state) ? { id } : { id, status: { notIn: REFUND_STATES } };
    // cast at the write seam: OrderRow.status is a plain string and refunds/attribution are unknown.
    const updated = await this.db.order.updateMany({ where: guard as never, data: { ...rest } as never });
    if (updated.count > 0) return;
    const existing = await this.db.order.findFirst({ where: { id }, select: { id: true } });
    if (!existing) await this.db.order.create({ data: { id, ...rest } as never });
  }
}
