import { Money } from '../../shared-kernel/money';
import { CaptureResult, SaleRef } from './value-objects';

export const PaymentEventType = {
  PaymentIntentCreated: 'payment.intent_created',
  PaymentCaptured: 'payment.captured',
  PaymentFailed: 'payment.failed',
  PaymentCanceled: 'payment.canceled',
  RefundIssued: 'payment.refund_issued',
} as const;

export function paymentCaptured(args: {
  saleRef: SaleRef;
  sessionId?: string;
  captureResult: CaptureResult;
  idempotencyKey: string;
}) {
  return {
    type: PaymentEventType.PaymentCaptured,
    saleRef: args.saleRef.value,
    sessionId: args.sessionId,
    idempotencyKey: args.idempotencyKey,
    payload: {
      providerChargeId: args.captureResult.providerChargeId,
      capturedAmountMinor: args.captureResult.capturedAmount.amountMinor,
      currencyCode: args.captureResult.capturedAmount.currencyCode,
      cardBrand: args.captureResult.cardBrand,
      last4: args.captureResult.last4,
      payer: args.captureResult.payer,
    },
  };
}

export function refundIssued(args: {
  saleRef: SaleRef;
  refunded: Money;
  parentTransactionId: string;
  refundTransactionId: string;
  idempotencyKey: string;
}) {
  return {
    type: PaymentEventType.RefundIssued,
    saleRef: args.saleRef.value,
    idempotencyKey: args.idempotencyKey,
    payload: {
      refundedAmountMinor: args.refunded.amountMinor,
      currencyCode: args.refunded.currencyCode,
      parentTransactionId: args.parentTransactionId,
      refundTransactionId: args.refundTransactionId,
    },
  };
}
