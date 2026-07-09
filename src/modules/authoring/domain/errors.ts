export class InvalidStateTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Illegal transition ${from} -> ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}
export class PageValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Page validation failed: ${issues.join('; ')}`);
    this.name = 'PageValidationError';
  }
}
export class FunnelReachabilityError extends Error {
  constructor(readonly unreachable: string[]) {
    super(`Unreachable steps: ${unreachable.join(', ')}`);
    this.name = 'FunnelReachabilityError';
  }
}
export class SlotUnsatisfiedError extends Error {
  constructor(readonly missing: string[]) {
    super(`Required slots unsatisfied: ${missing.join(', ')}`);
    this.name = 'SlotUnsatisfiedError';
  }
}
