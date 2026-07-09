import type { RecallCampaign } from '../domain/recall-campaign';
import type { RecallAttempt } from '../domain/recall-attempt';
import type { SuppressionEntry, RecallSuppressionReason } from '../domain/suppression';
import type { SuppressionScopeValue, ChannelValue } from '../domain/value-objects';

export interface CampaignDashboardPort {
  getCampaign(): Promise<RecallCampaign | null>;
  putCampaign(input: unknown): Promise<RecallCampaign>;
}
export interface CheckoutLifecyclePort {
  onFunnelSessionAbandoned(evt: FunnelSessionAbandonedEvent): Promise<void>;
  onCheckoutPaid(evt: PaymentCapturedEvent): Promise<void>;
}
export interface DueTouchTriggerPort {
  processDueBatch(limit: number): Promise<{ processed: number }>;
}
export interface EngagementCallbackPort {
  onEngagement(evt: EngagementCallbackEvent): Promise<void>;
  onRecipientSuppressed(evt: RecipientSuppressedEvent): Promise<void>;
}

export interface RecallCampaignRepository {
  findActive(): Promise<RecallCampaign | null>;
  save(campaign: RecallCampaign): Promise<RecallCampaign>;
}
export interface RecallAttemptRepository {
  findByDedupeKey(checkoutRef: string, campaignRef: string): Promise<RecallAttempt | null>;
  findByCheckoutRef(checkoutRef: string): Promise<RecallAttempt[]>;
  save(attempt: RecallAttempt): Promise<RecallAttempt>;
  claimDueBatch(now: Date, limit: number): Promise<RecallAttempt[]>; // FOR UPDATE SKIP LOCKED + lease
}
export interface SuppressionRepository {
  findActiveBySubject(subjectKeys: string[], now: Date): Promise<SuppressionEntry[]>;
  upsert(entry: SuppressionEntry): Promise<SuppressionEntry>;
  list(): Promise<SuppressionEntry[]>;
  remove(scope: SuppressionScopeValue, subjectKey: string): Promise<void>;
}

export interface ComposedTouch {
  channel: ChannelValue;
  recipientAddress: string;
  templateKey: string;
  mergeVariables: Record<string, unknown>;
  idempotencyKey: string;
}
export interface MessagingPort {
  sendTouch(touch: ComposedTouch): Promise<{ messageHandoffRef: string }>;
}

// Authoritative paid/voided re-check at touch-fire time.
export interface CheckoutPaymentStatusPort {
  getStatus(checkoutRef: string): Promise<{ paid: boolean; voided: boolean }>;
}
export interface CheckoutResumePort {
  buildResumeLink(checkoutRef: string, originalParams: Record<string, string>): Promise<string>;
}
export interface CommerceGatewayReadPort {
  resolveIncentive(incentiveRef: string): Promise<{ code: string } | null>;
}
export interface AppConfigPort {
  getRecallConfig(): Promise<RecallConfig>;
}
export interface RecallConfig {
  enabled: boolean;
  quietHours: { startHourUtc: number; endHourUtc: number } | null;
  attributionWindowHours: number;
}
export interface EventPublisherPort {
  publish(event: { type: string; payload: Record<string, unknown> }): Promise<void>;
}
export interface JobQueuePort {
  enqueue(input: { kind: string; idempotencyKey: string; payload: Record<string, unknown>; runAt?: Date }): Promise<void>;
}

export interface FunnelSessionAbandonedEvent {
  checkoutRef: string;
  sessionId: string;
  funnelId: string;
  locale: string;
  cartValueMinor: number;
  contact?: { hashedIdentity: string; normalizedEmail?: string; normalizedPhone?: string; consentedChannels: ChannelValue[] };
  attributionParams: Record<string, string>;
}
export interface PaymentCapturedEvent {
  saleRef: string;
  checkoutRef: string;
  capturedAt: string;
}
export interface EngagementCallbackEvent {
  messageHandoffRef: string;
  delivery?: 'delivered' | 'bounced' | 'failed';
  engagement?: 'opened' | 'clicked' | 'unsubscribed';
}
export interface RecipientSuppressedEvent {
  channel: ChannelValue;
  normalizedAddress: string;
  hashedIdentity: string;
  messagingReason: string;
}

export type { RecallSuppressionReason };
