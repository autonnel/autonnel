import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaTransactionRepository } from '../transaction.repository';
import { RefundKind } from '../../../domain/value-objects';
import { Money } from '../../../../shared-kernel/money';

vi.mock('@/lib/tenant/context', () => ({
  getCurrentTenantId: () => 'default',
  tryGetTenantId: () => 'default',
}));

interface TxSpies {
  queryRaw: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  aggregate: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

function makePrisma(opts: { existing?: any; priorSumMinor?: number }) {
  const order: string[] = [];
  const spies: TxSpies = {
    queryRaw: vi.fn(async () => { order.push('lock'); return []; }),
    findFirst: vi.fn(async () => { order.push('findFirst'); return opts.existing ?? null; }),
    aggregate: vi.fn(async () => { order.push('aggregate'); return { _sum: { amountMinor: opts.priorSumMinor ?? 0 } }; }),
    create: vi.fn(async () => { order.push('create'); return {}; }),
  };
  const tx = {
    $queryRaw: spies.queryRaw,
    transaction: { findFirst: spies.findFirst, aggregate: spies.aggregate, create: spies.create },
  };
  const prisma = { $transaction: vi.fn(async (cb: any) => cb(tx)) };
  return { prisma, spies, order };
}

const decideFixed = (amountMinor: number) =>
  vi.fn((_prior: number) => ({ id: 'rt_1', kind: RefundKind.FIXED, amount: Money.of(amountMinor, 'USD') }));

describe('PrismaTransactionRepository.reserveRefund', () => {
  beforeEach(() => vi.clearAllMocks());

  it('locks the parent row before reading the prior sum, then creates a PENDING reservation', async () => {
    const { prisma, spies, order } = makePrisma({ priorSumMinor: 1000 });
    const repo = new PrismaTransactionRepository(prisma);
    const decide = decideFixed(2000);

    const res = await repo.reserveRefund({ parentTransactionId: 'int_1', chargeRef: 'ch_1', idempotencyKey: 'k1', decide });

    expect(order).toEqual(['lock', 'findFirst', 'aggregate', 'create']);
    expect(spies.queryRaw).toHaveBeenCalledTimes(1); // FOR UPDATE
    expect(decide).toHaveBeenCalledWith(1000); // sized against the live sum
    expect(spies.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ id: 'rt_1', type: 'REFUND', status: 'PENDING', parentTransactionId: 'int_1', chargeRef: 'ch_1', amountMinor: 2000, idempotencyKey: 'k1' }),
    }));
    expect(res.status).toBe('reserved');
    expect(res.refund.amount.amountMinor).toBe(2000);
  });

  it('short-circuits to duplicate when a refund already exists for the idempotency key', async () => {
    const { prisma, spies } = makePrisma({ existing: { id: 'rt_prior', parentTransactionId: 'int_1', refundKind: 'fixed', amountMinor: 2000, currencyCode: 'USD', providerRefundRef: 're_x', reason: null } });
    const repo = new PrismaTransactionRepository(prisma);
    const decide = decideFixed(2000);

    const res = await repo.reserveRefund({ parentTransactionId: 'int_1', chargeRef: 'ch_1', idempotencyKey: 'k1', decide });

    expect(res.status).toBe('duplicate');
    expect(res.refund.id).toBe('rt_prior');
    expect(decide).not.toHaveBeenCalled();
    expect(spies.aggregate).not.toHaveBeenCalled();
    expect(spies.create).not.toHaveBeenCalled();
  });

  it('does not create a reservation when decide rejects the amount (balance guard)', async () => {
    const { prisma, spies } = makePrisma({ priorSumMinor: 4000 });
    const repo = new PrismaTransactionRepository(prisma);
    const decide = vi.fn(() => { throw new Error('RefundExceedsCaptured'); });

    await expect(repo.reserveRefund({ parentTransactionId: 'int_1', chargeRef: 'ch_1', idempotencyKey: 'k1', decide })).rejects.toThrow('RefundExceedsCaptured');
    expect(spies.create).not.toHaveBeenCalled();
  });
});
