import { Money } from '../../shared-kernel/money';
import { RefundKind } from './value-objects';
import { RefundExceedsCapturedError } from './errors';

export interface RefundResolveInput {
  kind: RefundKind;
  captured: Money;
  priorRefunds: Money;
  fixedAmount?: Money;
  percentage?: number;
}

export class RefundAmountCalculator {
  resolve(input: RefundResolveInput): Money {
    const { kind, captured, priorRefunds } = input;
    const remaining = captured.subtract(priorRefunds); // throws on currency mismatch

    let amount: Money;
    switch (kind) {
      case RefundKind.FULL:
        amount = remaining;
        break;
      case RefundKind.FIXED:
        if (!input.fixedAmount) throw new Error('FIXED refund requires fixedAmount');
        amount = input.fixedAmount;
        captured.subtract(input.fixedAmount);
        break;
      case RefundKind.PERCENTAGE: {
        if (input.percentage == null || input.percentage <= 0 || input.percentage > 100) {
          throw new Error('PERCENTAGE refund requires 0 < percentage <= 100');
        }
        amount = captured.multiplyByFraction(input.percentage, 100);
        break;
      }
      default:
        throw new Error(`Unsupported RefundKind: ${kind}`);
    }

    if (!amount.isPositive()) throw new Error('Refund amount must be positive');
    if (amount.amountMinor > remaining.amountMinor) throw new RefundExceedsCapturedError();
    return amount;
  }
}
