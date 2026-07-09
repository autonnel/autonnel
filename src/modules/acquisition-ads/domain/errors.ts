export class IllegalConnectionTransition extends Error {
  constructor(from: string, to: string) {
    super(`Illegal connection transition ${from} -> ${to}`);
    this.name = 'IllegalConnectionTransition';
  }
}
export class StaleTokenVersion extends Error {
  constructor(expected: number, actual: number) {
    super(`Stale token version: expected ${expected}, current ${actual}`);
    this.name = 'StaleTokenVersion';
  }
}
export class PostbackTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Illegal postback transition ${from} -> ${to}`);
    this.name = 'PostbackTransitionError';
  }
}
export class MappingActivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MappingActivationError';
  }
}
