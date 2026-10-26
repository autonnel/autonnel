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
// A connection with an empty externalAccountId can never sync (see connection.repository's
// unique index and every insights adapter, which key off this field verbatim), so authorization
// must fail honestly here instead of persisting a connection nobody can use.
export class NoAdAccountsDiscoveredError extends Error {
  code = 'NO_AD_ACCOUNTS' as const;
  constructor(platform: string) {
    super(`No ad accounts were discovered for platform ${platform}`);
    this.name = 'NoAdAccountsDiscoveredError';
  }
}
