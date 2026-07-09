import { IllegalPaymentTransitionError } from './errors';

export const PaymentIntentStatus = {
  REQUIRES_PAYMENT: 'REQUIRES_PAYMENT',
  PROCESSING: 'PROCESSING',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED',
} as const;
export type PaymentIntentStatus = (typeof PaymentIntentStatus)[keyof typeof PaymentIntentStatus];

const ALLOWED: Record<PaymentIntentStatus, PaymentIntentStatus[]> = {
  REQUIRES_PAYMENT: [
    PaymentIntentStatus.PROCESSING,
    PaymentIntentStatus.AUTHORIZED,
    PaymentIntentStatus.CAPTURED,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.CANCELED,
  ],
  PROCESSING: [PaymentIntentStatus.CAPTURED, PaymentIntentStatus.FAILED, PaymentIntentStatus.CANCELED],
  AUTHORIZED: [PaymentIntentStatus.CAPTURED, PaymentIntentStatus.CANCELED, PaymentIntentStatus.FAILED],
  CAPTURED: [],
  FAILED: [],
  CANCELED: [],
};

export class PaymentIntentStateMachine {
  canTransitionTo(from: PaymentIntentStatus, to: PaymentIntentStatus): boolean {
    return ALLOWED[from].includes(to);
  }

  // CAPTURED -> CAPTURED for the same charge is a replay no-op, not an error.
  isIdempotentSelfTransition(from: PaymentIntentStatus, to: PaymentIntentStatus): boolean {
    return from === to;
  }

  assertTransition(from: PaymentIntentStatus, to: PaymentIntentStatus): void {
    if (this.isIdempotentSelfTransition(from, to)) return;
    if (!this.canTransitionTo(from, to)) throw new IllegalPaymentTransitionError(from, to);
  }
}
