import { describe, it, expect } from "vitest";
import { Money } from "@/modules/shared-kernel/money";
import { Order } from "../domain/order";
import { OfferLineSnapshot, CustomerSnapshot } from "../domain/value-objects";
import type { OrderRepositoryPort } from "./ports";
import { SetOrderNoteService } from "./set-order-note.service";

function makeOrder(): Order {
  return Order.createFromPaidSale({
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
}

function fakeRepo(order: Order | null) {
  const state: { saved: Order | null } = { saved: null };
  const repo: OrderRepositoryPort = {
    findBySaleRef: async () => null,
    findById: async () => order,
    findPaidWithBackendRef: async () => ({ orders: [], nextCursor: null }),
    save: async (o) => {
      state.saved = o;
    },
  };
  return { repo, state };
}

describe("SetOrderNoteService", () => {
  it("trims and persists the note", async () => {
    const order = makeOrder();
    const { repo, state } = fakeRepo(order);
    const svc = new SetOrderNoteService(repo);

    const out = await svc.execute("ord_1", "  fragile  ");

    expect(out.state).toBe("OK");
    expect(out.note).toBe("fragile");
    expect(state.saved?.note).toBe("fragile");
  });

  it("clears the note when blank", async () => {
    const order = makeOrder();
    order.setNote("old");
    const { repo } = fakeRepo(order);
    const out = await new SetOrderNoteService(repo).execute("ord_1", "   ");
    expect(out.note).toBeNull();
  });

  it("returns NOT_FOUND for an unknown order", async () => {
    const { repo } = fakeRepo(null);
    const out = await new SetOrderNoteService(repo).execute("missing", "x");
    expect(out.state).toBe("NOT_FOUND");
    expect(out.note).toBeNull();
  });
});
