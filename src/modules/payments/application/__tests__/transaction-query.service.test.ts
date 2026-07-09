import { describe, it, expect } from "vitest";
import { TransactionQueryService } from "../transaction-query.service";
import type {
  TransactionReadPort,
  TransactionListItem,
  TransactionListPage,
} from "../transaction-query.service";

function item(over: Partial<TransactionListItem> = {}): TransactionListItem {
  return {
    id: "tx_1",
    type: "REFUND",
    status: "SUCCEEDED",
    parentTransactionId: "pi_1",
    refundKind: "full",
    amountMinor: 5000,
    currencyCode: "USD",
    provider: "STRIPE",
    providerRefundRef: "re_1",
    reason: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function fakeReader(items: TransactionListItem[]): {
  reader: TransactionReadPort;
  calls: Array<{ page: number; limit: number; filters: unknown }>;
} {
  const calls: Array<{ page: number; limit: number; filters: unknown }> = [];
  const reader: TransactionReadPort = {
    list: async (input) => {
      calls.push({ page: input.page, limit: input.limit, filters: input.filters });
      const page: TransactionListPage = {
        items,
        total: items.length,
        page: input.page,
        limit: input.limit,
        totalPages: 1,
      };
      return page;
    },
    findById: async (id) => items.find((t) => t.id === id) ?? null,
  };
  return { reader, calls };
}

describe("TransactionQueryService", () => {
  it("clamps the limit to 100 and floors page at 1", async () => {
    const { reader, calls } = fakeReader([item()]);
    const svc = new TransactionQueryService(reader);
    await svc.list({}, 0, 9999);
    expect(calls[0]).toMatchObject({ page: 1, limit: 100 });
  });

  it("looks up a transaction by id", async () => {
    const { reader } = fakeReader([item({ id: "tx_x" })]);
    const svc = new TransactionQueryService(reader);
    expect((await svc.get("tx_x"))?.id).toBe("tx_x");
    expect(await svc.get("missing")).toBeNull();
  });

  it("filters refunds for a parent intent", async () => {
    const { reader, calls } = fakeReader([item()]);
    const svc = new TransactionQueryService(reader);
    const refunds = await svc.byParent("pi_1");
    expect(refunds).toHaveLength(1);
    expect(calls[0].filters).toMatchObject({ parentTransactionId: "pi_1", type: "REFUND" });
  });
});
