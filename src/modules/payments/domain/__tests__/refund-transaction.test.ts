import { describe, it, expect } from 'vitest';
import { RefundTransaction } from '../refund-transaction';
import { RefundKind } from '../value-objects';
import { Money } from '../../../shared-kernel/money';

describe('RefundTransaction', () => {
  it('references exactly one parent intent and a resolved Money amount', () => {
    const t = RefundTransaction.create({
      id: 'rt_1',
      parentTransactionId: 'int_1',
      kind: RefundKind.FIXED,
      amount: Money.of(500, 'USD'),
      reason: 'customer request',
    });
    expect(t.parentTransactionId).toBe('int_1');
    expect(t.amount.amountMinor).toBe(500);
    expect(t.acknowledged).toBe(false);
  });

  it('acknowledge attaches the provider refund ref and freezes the record', () => {
    const t = RefundTransaction.create({ id: 'rt_1', parentTransactionId: 'int_1', kind: RefundKind.FULL, amount: Money.of(500, 'USD') });
    t.acknowledge('re_provider_1');
    expect(t.acknowledged).toBe(true);
    expect(t.providerRefundRef).toBe('re_provider_1');
    expect(() => t.acknowledge('re_x')).toThrow('immutable');
  });
});
