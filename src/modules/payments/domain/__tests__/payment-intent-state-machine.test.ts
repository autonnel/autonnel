import { describe, it, expect } from 'vitest';
import {
  PaymentIntentStatus,
  PaymentIntentStateMachine,
} from '../payment-intent-state-machine';
import { IllegalPaymentTransitionError } from '../errors';

describe('PaymentIntentStateMachine', () => {
  const sm = new PaymentIntentStateMachine();

  it('allows REQUIRES_PAYMENT → PROCESSING → CAPTURED (automatic capture)', () => {
    expect(sm.canTransitionTo(PaymentIntentStatus.REQUIRES_PAYMENT, PaymentIntentStatus.PROCESSING)).toBe(true);
    expect(sm.canTransitionTo(PaymentIntentStatus.PROCESSING, PaymentIntentStatus.CAPTURED)).toBe(true);
  });

  it('allows the manual-capture path REQUIRES_PAYMENT → AUTHORIZED → CAPTURED', () => {
    expect(sm.canTransitionTo(PaymentIntentStatus.REQUIRES_PAYMENT, PaymentIntentStatus.AUTHORIZED)).toBe(true);
    expect(sm.canTransitionTo(PaymentIntentStatus.AUTHORIZED, PaymentIntentStatus.CAPTURED)).toBe(true);
  });

  it('treats CAPTURED / FAILED / CANCELED as terminal', () => {
    expect(sm.canTransitionTo(PaymentIntentStatus.CAPTURED, PaymentIntentStatus.PROCESSING)).toBe(false);
    expect(sm.canTransitionTo(PaymentIntentStatus.FAILED, PaymentIntentStatus.CAPTURED)).toBe(false);
    expect(sm.canTransitionTo(PaymentIntentStatus.CANCELED, PaymentIntentStatus.CAPTURED)).toBe(false);
  });

  it('re-applying CAPTURED → CAPTURED is a no-op (idempotent), not illegal', () => {
    expect(sm.isIdempotentSelfTransition(PaymentIntentStatus.CAPTURED, PaymentIntentStatus.CAPTURED)).toBe(true);
  });

  it('assertTransition throws IllegalPaymentTransitionError on an illegal jump', () => {
    expect(() =>
      sm.assertTransition(PaymentIntentStatus.CAPTURED, PaymentIntentStatus.AUTHORIZED),
    ).toThrow(IllegalPaymentTransitionError);
  });
});
