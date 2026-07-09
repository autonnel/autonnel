import { describe, it, expect } from 'vitest';
import { RefundAmountCalculator } from '../refund-amount-calculator';
import { RefundKind } from '../value-objects';
import { RefundExceedsCapturedError } from '../errors';
import { Money } from '../../../shared-kernel/money';

describe('RefundAmountCalculator', () => {
  const calc = new RefundAmountCalculator();
  const captured = Money.of(10000, 'USD');

  it('FULL refunds the remaining (captured - priorRefunds)', () => {
    const amount = calc.resolve({ kind: RefundKind.FULL, captured, priorRefunds: Money.of(2000, 'USD') });
    expect(amount.amountMinor).toBe(8000);
  });

  it('FIXED refunds the given Money when within the remaining', () => {
    const amount = calc.resolve({ kind: RefundKind.FIXED, captured, priorRefunds: Money.of(0, 'USD'), fixedAmount: Money.of(2500, 'USD') });
    expect(amount.amountMinor).toBe(2500);
  });

  it('PERCENTAGE refunds a floored fraction of the captured total', () => {
    const amount = calc.resolve({ kind: RefundKind.PERCENTAGE, captured, priorRefunds: Money.of(0, 'USD'), percentage: 33 });
    expect(amount.amountMinor).toBe(3300);
  });

  it('throws RefundExceedsCapturedError when summed refunds would exceed captured', () => {
    expect(() =>
      calc.resolve({ kind: RefundKind.FIXED, captured, priorRefunds: Money.of(9000, 'USD'), fixedAmount: Money.of(2000, 'USD') }),
    ).toThrow(RefundExceedsCapturedError);
  });

  it('rejects a currency mismatch between captured and fixed amount', () => {
    expect(() =>
      calc.resolve({ kind: RefundKind.FIXED, captured, priorRefunds: Money.of(0, 'USD'), fixedAmount: Money.of(2000, 'EUR') }),
    ).toThrow();
  });
});
