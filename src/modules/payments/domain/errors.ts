export class IllegalPaymentTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Illegal PaymentIntent transition ${from} -> ${to}`);
    this.name = 'IllegalPaymentTransitionError';
  }
}

export class IntentNotCapturedError extends Error {
  constructor(intentId: string) {
    super(`Refund requires a CAPTURED PaymentIntent: ${intentId}`);
    this.name = 'IntentNotCapturedError';
  }
}

export class RefundExceedsCapturedError extends Error {
  constructor() {
    super('Summed refunds would exceed the captured total');
    this.name = 'RefundExceedsCapturedError';
  }
}
