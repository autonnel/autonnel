import { describe, it, expect, vi } from 'vitest';
import { querySystemActivity } from './system-activity';

interface FindManyArgs {
  where: Record<string, unknown>;
}

function buildDb(rows: {
  orders?: unknown[];
  fulfillments?: unknown[];
  refunds?: unknown[];
  failedCharges?: unknown[];
}) {
  const orderFindMany = vi.fn(async (args: FindManyArgs) =>
    args.where.trackingNumber ? rows.fulfillments ?? [] : rows.orders ?? [],
  );
  const transactionFindMany = vi.fn(async (args: FindManyArgs) =>
    args.where.type === 'REFUND' ? rows.refunds ?? [] : rows.failedCharges ?? [],
  );
  const db = {
    order: { findMany: orderFindMany },
    transaction: { findMany: transactionFindMany },
  };
  return { db, orderFindMany, transactionFindMany };
}

const NOW = new Date('2026-06-25T12:00:00Z');

describe('querySystemActivity tenant isolation', () => {
  it('scopes every underlying query by the explicit tenantId', async () => {
    const { db, orderFindMany, transactionFindMany } = buildDb({});
    await querySystemActivity(db as never, 'tenant-A', NOW, 50, 24 * 60 * 60 * 1000);

    for (const call of [...orderFindMany.mock.calls, ...transactionFindMany.mock.calls]) {
      expect((call[0] as FindManyArgs).where.tenantId).toBe('tenant-A');
    }
    // two order queries (created + fulfillments) and two transaction queries (refunds + failed charges)
    expect(orderFindMany).toHaveBeenCalledTimes(2);
    expect(transactionFindMany).toHaveBeenCalledTimes(2);
  });

  it('maps rows into entries sorted newest-first', async () => {
    const { db } = buildDb({
      orders: [
        { createdAt: new Date('2026-06-25T11:00:00Z'), orderNumber: '1001', status: 'PAID', capturedTotal: 4999, currencyCode: 'USD' },
      ],
      refunds: [
        { createdAt: new Date('2026-06-25T11:30:00Z'), amountMinor: 1000, currencyCode: 'USD', provider: 'stripe' },
      ],
    });

    const entries = await querySystemActivity(db as never, 'tenant-A', NOW, 50, 24 * 60 * 60 * 1000);

    expect(entries.map((e) => e.kind)).toEqual(['refund', 'order']);
    expect(entries[0].payload).toBe('USD 10.00');
    expect(entries[1].text).toContain('order paid 1001');
    expect(entries[1].payload).toBe('USD 49.99');
  });
});
