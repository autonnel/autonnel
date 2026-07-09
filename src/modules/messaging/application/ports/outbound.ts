import type { Dispatch, DispatchSnapshot } from '../../domain/dispatch';
import type { MessageTemplate } from '../../domain/message-template';
import type { SuppressionEntry } from '../../domain/suppression-entry';
import type { Address, ChannelType, SenderIdentity } from '../../domain/value-objects';
import type { RenderedMessage } from '../../domain/rendered-message';
export type { JobEnqueuePort, EventPublisherPort } from '@/modules/shared-kernel';

// One HTTP-API adapter per provider (Resend/Postmark/SES). No SMTP socket.
export interface SendEmailInput {
  from: string;
  fromName?: string;
  replyTo?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}
export interface SendEmailResult {
  providerMessageId: string;
}
export interface MessageDeliveryProviderPort {
  readonly slug: string;
  send(input: SendEmailInput): Promise<SendEmailResult>;
  parseWebhook(verifiedPayload: unknown): Promise<DeliveryReceiptEvent[]>;
}

export interface DeliveryReceiptEvent {
  providerMessageId: string;
  kind: 'DELIVERED' | 'HARD_BOUNCE' | 'SOFT_BOUNCE' | 'COMPLAINT' | 'OPENED' | 'CLICKED';
  recipient: string;
  occurredAt: Date;
}

export interface TemplateRepositoryPort {
  findByKey(templateKey: string): Promise<MessageTemplate | null>;
  save(template: MessageTemplate): Promise<MessageTemplate>;
  list(): Promise<MessageTemplate[]>;
}

export interface DispatchRepositoryPort {
  findById(dispatchId: string): Promise<Dispatch | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<Dispatch | null>;
  findByProviderMessageId(providerMessageId: string): Promise<Dispatch | null>;
  findRetryable(limit: number, now: Date): Promise<Dispatch[]>;
  save(dispatch: Dispatch): Promise<Dispatch>; // upsert keyed on (tenantId, idempotencyKey)
}

export interface SuppressionRepositoryPort {
  findForAddress(address: Address): Promise<SuppressionEntry[]>;
  upsert(entry: SuppressionEntry): Promise<SuppressionEntry>;
  list(channel?: ChannelType): Promise<SuppressionEntry[]>;
}

export interface ResolvedSender {
  senderIdentityId: string;
  sender: SenderIdentity;
}

export interface TenantConfigPort {
  channelProviders(channel: ChannelType): Promise<{ primary: string; fallback?: string }>;
  defaultSender(channel: ChannelType): Promise<ResolvedSender>;
  unsubscribeBaseUrl(): Promise<string>;
}

export interface ClockPort {
  now(): Date;
}

export type { RenderedMessage, DispatchSnapshot };
