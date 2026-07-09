export enum ChannelType {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WEBHOOK = 'WEBHOOK',
  PUSH = 'PUSH',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Address {
  private constructor(
    readonly channel: ChannelType,
    readonly raw: string,
    readonly normalized: string,
  ) {}

  static of(channel: ChannelType, raw: string): Address {
    const trimmed = raw.trim();
    if (!trimmed) throw new Error('Address must not be empty');
    let normalized = trimmed;
    if (channel === ChannelType.EMAIL) {
      normalized = trimmed.toLowerCase();
      if (!EMAIL_RE.test(normalized)) throw new Error(`invalid email address: ${raw}`);
    }
    return new Address(channel, trimmed, normalized);
  }

  equals(other: Address): boolean {
    return this.channel === other.channel && this.normalized === other.normalized;
  }
}

export class TemplateKey {
  private constructor(readonly value: string) {}
  static of(value: string): TemplateKey {
    const v = value.trim();
    if (!v) throw new Error('TemplateKey must not be empty');
    return new TemplateKey(v);
  }
  equals(other: TemplateKey): boolean {
    return this.value === other.value;
  }
}

export interface SenderIdentityInput {
  fromAddress: string;
  fromName?: string;
  verified: boolean;
  replyTo?: string;
}

export class SenderIdentity {
  private constructor(
    readonly fromAddress: string,
    readonly verified: boolean,
    readonly fromName?: string,
    readonly replyTo?: string,
  ) {}

  static of(input: SenderIdentityInput): SenderIdentity {
    if (!EMAIL_RE.test(input.fromAddress.trim())) throw new Error('SenderIdentity.fromAddress must be a valid email');
    if (!input.verified) throw new Error('SenderIdentity must be verified (DKIM/SPF) before use');
    return new SenderIdentity(input.fromAddress.trim(), true, input.fromName, input.replyTo);
  }
}

export interface ProviderRef {
  readonly providerSlug: string;
  readonly providerMessageId: string;
}

export interface Correlation {
  readonly sourceContext: string;
  readonly sourceEventId?: string;
  readonly traceId?: string;
}

export enum DispatchStatus {
  QUEUED = 'QUEUED',
  RENDERED = 'RENDERED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  BOUNCED = 'BOUNCED',
  COMPLAINED = 'COMPLAINED',
  FAILED = 'FAILED',
  SUPPRESSED = 'SUPPRESSED',
  CANCELED = 'CANCELED',
}

const TERMINAL = new Set<DispatchStatus>([
  DispatchStatus.DELIVERED,
  DispatchStatus.BOUNCED,
  DispatchStatus.COMPLAINED,
  DispatchStatus.SUPPRESSED,
  DispatchStatus.CANCELED,
]);

export function isTerminalStatus(s: DispatchStatus): boolean {
  return TERMINAL.has(s);
}

export enum SuppressionReason {
  HardBounce = 'HardBounce',
  Complaint = 'Complaint',
  Unsubscribe = 'Unsubscribe',
  ManualBlock = 'ManualBlock',
}
