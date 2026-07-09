import { describe, it, expect } from 'vitest';
import { PaymentIntent } from '../payment-intent';
import { PaymentIntentStatus } from '../payment-intent-state-machine';
import { CaptureResult, SaleRef, CaptureMethod } from '../value-objects';
import { Money } from '../../../shared-kernel/money';
import { IntentNotCapturedError } from '../errors';

const newIntent = () =>
  PaymentIntent.create({
    id: 'int_1',
    saleRef: SaleRef.of('sale_1'),
    provider: 'STRIPE',
    amount: Money.of(1999, 'USD'),
    captureMethod: CaptureMethod.AUTOMATIC,
  });

const capture = () =>
  CaptureResult.of({ providerChargeId: 'ch_1', capturedAmount: Money.of(1999, 'USD'), capturedAt: new Date() });

describe('PaymentIntent', () => {
  it('starts in REQUIRES_PAYMENT with immutable amount/currency/provider/saleRef', () => {
    const intent = newIntent();
    expect(intent.status).toBe(PaymentIntentStatus.REQUIRES_PAYMENT);
    expect(intent.amount.amountMinor).toBe(1999);
    expect(intent.captureResult).toBeUndefined();
  });

  it('rejects a non-positive amount at creation', () => {
    expect(() =>
      PaymentIntent.create({ id: 'x', saleRef: SaleRef.of('s'), provider: 'STRIPE', amount: Money.of(0, 'USD'), captureMethod: CaptureMethod.AUTOMATIC }),
    ).toThrow('Money > 0');
  });

  it('markCaptured sets CAPTURED + CaptureResult and is idempotent for the same charge', () => {
    const intent = newIntent();
    intent.markCaptured(capture());
    expect(intent.status).toBe(PaymentIntentStatus.CAPTURED);
    expect(intent.captureResult?.providerChargeId).toBe('ch_1');
    intent.markCaptured(capture()); // replay no-op
    expect(intent.status).toBe(PaymentIntentStatus.CAPTURED);
  });

  it('recordRefund rejects when not CAPTURED', () => {
    const intent = newIntent();
    expect(() => intent.recordRefund({ transactionId: 'r1', amount: Money.of(100, 'USD') })).toThrow(IntentNotCapturedError);
  });

  it('recordRefund appends to RefundRecord[] and tracks summed refunds', () => {
    const intent = newIntent();
    intent.markCaptured(capture());
    intent.recordRefund({ transactionId: 'r1', amount: Money.of(500, 'USD') });
    intent.recordRefund({ transactionId: 'r2', amount: Money.of(500, 'USD') });
    expect(intent.totalRefunded().amountMinor).toBe(1000);
    expect(intent.refundRecords).toHaveLength(2);
  });
});
