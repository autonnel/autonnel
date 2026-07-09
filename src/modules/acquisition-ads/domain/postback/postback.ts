import type { ConversionEvent } from '../value-objects/conversion-event';
import type { RetryPolicy } from '../value-objects/retry-policy';
import type { ClickIdentifier } from '../value-objects/click-identifier';
import type { HashedIdentity } from '../value-objects/hashed-identity';
import { PostbackTransitionError } from '../errors';

export type DeliveryStatus =
  | 'PENDING' | 'DISPATCHING' | 'ACKNOWLEDGED' | 'FAILED' | 'DEAD' | 'SUPPRESSED';

export interface AttemptLog {
  attempt: number;
  at: number;
  error?: string;
  retryable?: boolean;
}

export interface DispatchContext {
  clickIdentifiers: ClickIdentifier[];
  hashedIdentity: HashedIdentity;
}

interface CreateProps {
  id: string;
  destinationId: string;
  event: ConversionEvent;
  retryPolicy: RetryPolicy;
  dispatchContext?: DispatchContext;
}

export class Postback {
  private constructor(
    readonly id: string,
    readonly destinationId: string,
    readonly event: ConversionEvent,
    private readonly retryPolicy: RetryPolicy,
    private _status: DeliveryStatus,
    private _attemptCount: number,
    private _attempts: AttemptLog[],
    private _nextAttemptAt: number | undefined,
    private _providerRef: string | undefined,
    private readonly _dispatchContext: DispatchContext | undefined,
  ) {}

  static create(p: CreateProps): Postback {
    return new Postback(p.id, p.destinationId, p.event, p.retryPolicy, 'PENDING', 0, [], undefined, undefined, p.dispatchContext);
  }

  static reconstitute(p: CreateProps & {
    status: DeliveryStatus;
    attemptCount: number;
    attempts: AttemptLog[];
    nextAttemptAt: number | undefined;
    providerRef: string | undefined;
  }): Postback {
    return new Postback(p.id, p.destinationId, p.event, p.retryPolicy, p.status, p.attemptCount, p.attempts, p.nextAttemptAt, p.providerRef, p.dispatchContext);
  }

  get status(): DeliveryStatus { return this._status; }
  get attemptCount(): number { return this._attemptCount; }
  get attempts(): readonly AttemptLog[] { return this._attempts; }
  get nextAttemptAt(): number | undefined { return this._nextAttemptAt; }
  get providerRef(): string | undefined { return this._providerRef; }
  get eventId(): string { return this.event.eventId; }
  get dispatchContext(): DispatchContext | undefined { return this._dispatchContext; }

  isTerminal(): boolean {
    return this._status === 'ACKNOWLEDGED' || this._status === 'DEAD' || this._status === 'SUPPRESSED';
  }

  beginDispatch(): void {
    if (this._status !== 'PENDING') throw new PostbackTransitionError(this._status, 'DISPATCHING');
    this._status = 'DISPATCHING';
  }

  acknowledge(providerRef: string): void {
    if (this._status !== 'DISPATCHING') throw new PostbackTransitionError(this._status, 'ACKNOWLEDGED');
    this._attemptCount += 1;
    this._providerRef = providerRef;
    this._attempts.push({ attempt: this._attemptCount, at: Date.now() });
    this._status = 'ACKNOWLEDGED';
  }

  fail(error: string, retryable: boolean, now = Date.now(), rand?: () => number): void {
    if (this._status !== 'DISPATCHING') throw new PostbackTransitionError(this._status, 'FAILED');
    this._attemptCount += 1;
    this._attempts.push({ attempt: this._attemptCount, at: now, error, retryable });
    if (!retryable || this.retryPolicy.isExhausted(this._attemptCount)) {
      this._status = 'DEAD';
      this._nextAttemptAt = undefined;
      return;
    }
    this._status = 'PENDING';
    this._nextAttemptAt = now + this.retryPolicy.computeNextDelayMs(this._attemptCount, rand);
  }

  suppress(_reason: string): void {
    if (this.isTerminal()) throw new PostbackTransitionError(this._status, 'SUPPRESSED');
    this._status = 'SUPPRESSED';
  }
}
