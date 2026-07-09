import { Address, ChannelType, DispatchStatus, SenderIdentity, TemplateKey, isTerminalStatus, type Correlation } from './value-objects';
import type { RenderedMessage } from './rendered-message';

export interface QueueDispatchInput {
  tenantId: string;
  idempotencyKey: string;
  channel: ChannelType;
  recipient: Address;
  templateKey: TemplateKey;
  templateVersionId: string;
  senderIdentityId: string;
  correlation: Correlation;
}

export interface DispatchSnapshot {
  id?: string;
  tenantId: string;
  idempotencyKey: string;
  channel: ChannelType;
  recipientNormalized: string;
  templateKey: string;
  templateVersionId: string;
  senderIdentityId: string;
  status: DispatchStatus;
  attemptCount: number;
  providerSlug?: string;
  providerMessageId?: string;
  lastError?: string;
  correlation: Correlation;
  renderedSubject?: string;
  renderedHtml?: string;
  renderedText?: string;
  renderedHeaders?: Record<string, string>;
}

export class Dispatch {
  private constructor(
    readonly tenantId: string,
    readonly idempotencyKey: string,
    readonly channel: ChannelType,
    readonly recipient: Address,
    readonly templateKey: TemplateKey,
    readonly templateVersionId: string,
    readonly senderIdentityId: string,
    readonly correlation: Correlation,
    private _status: DispatchStatus,
    private _attemptCount: number,
    private _rendered?: RenderedMessage,
    private _sender?: SenderIdentity,
    private _providerSlug?: string,
    private _providerMessageId?: string,
    private _lastError?: string,
    public id?: string,
  ) {}

  static queue(input: QueueDispatchInput): Dispatch {
    return new Dispatch(
      input.tenantId,
      input.idempotencyKey,
      input.channel,
      input.recipient,
      input.templateKey,
      input.templateVersionId,
      input.senderIdentityId,
      input.correlation,
      DispatchStatus.QUEUED,
      0,
    );
  }

  get status() { return this._status; }
  get attemptCount() { return this._attemptCount; }
  get rendered() { return this._rendered; }
  get providerMessageId() { return this._providerMessageId; }
  get providerSlug() { return this._providerSlug; }
  get lastError() { return this._lastError; }

  private assertNonTerminal(): void {
    if (isTerminalStatus(this._status)) throw new Error(`Dispatch is terminal (${this._status}) and immutable`);
  }

  attachRendered(rendered: RenderedMessage, sender: SenderIdentity): void {
    this.assertNonTerminal();
    this._rendered = rendered;
    this._sender = sender;
    this._status = DispatchStatus.RENDERED;
  }

  markAttempt(): void {
    this.assertNonTerminal();
    this._attemptCount += 1;
  }

  markSent(ref: { providerSlug: string; providerMessageId: string }): void {
    this.assertNonTerminal();
    if (!this._rendered || !this._sender) throw new Error('cannot send: missing rendered snapshot or sender identity');
    if (this._providerMessageId) throw new Error('providerMessageId already set (set at most once)');
    this._providerSlug = ref.providerSlug;
    this._providerMessageId = ref.providerMessageId;
    this._status = DispatchStatus.SENT;
    this._lastError = undefined;
  }

  markDelivered(): void { this.assertNonTerminal(); this._status = DispatchStatus.DELIVERED; }
  markBounced(): void { this.assertNonTerminal(); this._status = DispatchStatus.BOUNCED; }
  markComplained(): void { this.assertNonTerminal(); this._status = DispatchStatus.COMPLAINED; }

  markFailed(error: string, _retryable: boolean): void {
    this.assertNonTerminal();
    this._lastError = error;
    this._status = DispatchStatus.FAILED;
  }

  suppress(): void { this.assertNonTerminal(); this._status = DispatchStatus.SUPPRESSED; }
  cancel(): void { this.assertNonTerminal(); this._status = DispatchStatus.CANCELED; }

  toSnapshot(): DispatchSnapshot {
    return {
      id: this.id,
      tenantId: this.tenantId,
      idempotencyKey: this.idempotencyKey,
      channel: this.channel,
      recipientNormalized: this.recipient.normalized,
      templateKey: this.templateKey.value,
      templateVersionId: this.templateVersionId,
      senderIdentityId: this.senderIdentityId,
      status: this._status,
      attemptCount: this._attemptCount,
      providerSlug: this._providerSlug,
      providerMessageId: this._providerMessageId,
      lastError: this._lastError,
      correlation: this.correlation,
      renderedSubject: this._rendered?.subject,
      renderedHtml: this._rendered?.html,
      renderedText: this._rendered?.text,
      renderedHeaders: this._rendered?.headers ? { ...this._rendered.headers } : undefined,
    };
  }

  static rehydrate(s: DispatchSnapshot, rendered?: RenderedMessage, sender?: SenderIdentity): Dispatch {
    const d = new Dispatch(
      s.tenantId,
      s.idempotencyKey,
      s.channel,
      Address.of(s.channel, s.recipientNormalized),
      TemplateKey.of(s.templateKey),
      s.templateVersionId,
      s.senderIdentityId,
      s.correlation,
      s.status,
      s.attemptCount,
      rendered,
      sender,
      s.providerSlug,
      s.providerMessageId,
      s.lastError,
      s.id,
    );
    return d;
  }
}
