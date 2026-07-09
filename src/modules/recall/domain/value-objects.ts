export class CheckoutRef {
  private constructor(readonly value: string) {}
  static of(v: string): CheckoutRef {
    if (!v || v.trim() === '') throw new Error('CheckoutRef must be non-empty');
    return new CheckoutRef(v);
  }
}

const CHANNELS = ['email', 'sms', 'push', 'ad_retarget', 'webhook'] as const;
export type ChannelValue = (typeof CHANNELS)[number];
export class Channel {
  private constructor(readonly value: ChannelValue) {}
  static of(v: ChannelValue): Channel {
    if (!CHANNELS.includes(v)) throw new Error(`Unknown channel: ${v}`);
    return new Channel(v);
  }
}

export class DelayOffset {
  private constructor(readonly minutes: number) {}
  static ofMinutes(m: number): DelayOffset {
    if (!Number.isInteger(m) || m < 0) throw new Error('DelayOffset must be a non-negative integer of minutes');
    return new DelayOffset(m);
  }
  isBefore(other: DelayOffset): boolean {
    return this.minutes < other.minutes;
  }
}

const SCOPES = ['contact', 'checkout', 'channel-contact'] as const;
export type SuppressionScopeValue = (typeof SCOPES)[number];
export class SuppressionScope {
  private constructor(readonly value: SuppressionScopeValue) {}
  static of(v: SuppressionScopeValue): SuppressionScope {
    if (!SCOPES.includes(v)) throw new Error(`Unknown suppression scope: ${v}`);
    return new SuppressionScope(v);
  }
}

export class IncentiveRef {
  // Opaque — Recall never mints or validates; carries it onto the Touch only.
  private constructor(readonly value: string) {}
  static of(v: string): IncentiveRef {
    if (!v) throw new Error('IncentiveRef must be non-empty');
    return new IncentiveRef(v);
  }
}

const TERMINAL = ['recovered', 'suppressed', 'cancelled', 'cold'] as const;
const ATTEMPT_STATES = ['active', ...TERMINAL] as const;
export type AttemptStatusValue = (typeof ATTEMPT_STATES)[number];
export class AttemptStatus {
  private constructor(readonly value: AttemptStatusValue) {}
  static of(v: AttemptStatusValue): AttemptStatus {
    if (!ATTEMPT_STATES.includes(v)) throw new Error(`Unknown attempt status: ${v}`);
    return new AttemptStatus(v);
  }
  isTerminal(): boolean {
    return (TERMINAL as readonly string[]).includes(this.value);
  }
}

export interface ContactSnapshot {
  readonly hashedIdentity: string;
  readonly normalizedEmail?: string;
  readonly normalizedPhone?: string;
  readonly locale: string;
  readonly consentedChannels: ChannelValue[];
}

export type MessageHandoffRef = string;
export type DeliveryOutcome = 'pending' | 'delivered' | 'bounced' | 'failed';
export type EngagementOutcome = 'none' | 'opened' | 'clicked' | 'unsubscribed';
export type StopReason = 'paid' | 'optout' | 'bounce' | 'frequency_cap' | 'window_elapsed' | 'manual';
