import type { SuppressionScopeValue } from './value-objects';

export type RecallSuppressionReason = 'optout' | 'paid' | 'bounce' | 'frequency_cap' | 'quiet_window' | 'manual';
export type RecallSuppressionSource =
  | 'engagement_callback'
  | 'payment_captured'
  | 'messaging_suppressed'
  | 'manual_admin';

export interface SuppressionCreateInput {
  scope: SuppressionScopeValue;
  subjectKey: string;
  reason: RecallSuppressionReason;
  source: RecallSuppressionSource;
  expiresAt: Date | null;
}

const MESSAGING_REASON_MAP: Record<string, RecallSuppressionReason> = {
  HardBounce: 'bounce',
  Complaint: 'optout',
  Unsubscribe: 'optout',
  ManualBlock: 'manual',
};

export class SuppressionEntry {
  private constructor(
    public id: string | null,
    public readonly scope: SuppressionScopeValue,
    public readonly subjectKey: string,
    public readonly reason: RecallSuppressionReason,
    public readonly source: RecallSuppressionSource,
    public readonly createdAt: Date,
    public readonly expiresAt: Date | null,
  ) {}

  static create(input: SuppressionCreateInput, now: Date = new Date()): SuppressionEntry {
    if (!input.subjectKey) throw new Error('SuppressionEntry requires a subjectKey');
    return new SuppressionEntry(
      null,
      input.scope,
      input.subjectKey,
      input.reason,
      input.source,
      now,
      input.expiresAt,
    );
  }

  static fromMessagingSuppression(p: {
    channel: string;
    normalizedAddress: string;
    hashedIdentity: string;
    messagingReason: string;
  }): SuppressionEntry {
    const reason = MESSAGING_REASON_MAP[p.messagingReason] ?? 'manual';
    return SuppressionEntry.create({
      scope: 'contact',
      subjectKey: p.hashedIdentity,
      reason,
      source: 'messaging_suppressed',
      expiresAt: null, // hard-bounce / complaint / unsubscribe are permanent unless explicitly cleared
    });
  }

  matches(scope: SuppressionScopeValue, subjectKey: string): boolean {
    return this.scope === scope && this.subjectKey === subjectKey;
  }

  isActive(at: Date): boolean {
    return this.expiresAt === null || this.expiresAt.getTime() > at.getTime();
  }
}
