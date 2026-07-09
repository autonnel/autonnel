import type { ChannelType } from '../../domain/value-objects';

export interface SendNotificationCommand {
  channel: ChannelType;
  recipient: string;          // raw address; Messaging normalizes/validates
  templateKey: string;        // e.g. 'order.receipt'
  locale?: string;            // defaults to 'en'
  variables: Record<string, unknown>;
  idempotencyKey: string;     // caller-derived (e.g. hash(orderId+'order.shipped'))
  sourceContext: string;      // 'order-fulfillment' | 'recall' | 'identity' | ...
  sourceEventId?: string;
  traceId?: string;
  unsubscribeUrl?: string;    // optional override; otherwise tenant default
}

export interface SendNotificationResult {
  dispatchId: string;
  status: string;             // QUEUED | SUPPRESSED
  deduped: boolean;
}

export interface SendNotificationPort {
  send(command: SendNotificationCommand): Promise<SendNotificationResult>;
}

export interface DeliveryReceiptWebhookPort {
  // Called after signature verification + inside ALS tenant context.
  ingest(providerSlug: string, verifiedPayload: unknown): Promise<{ processed: number }>;
}

export interface PublishTemplateInput {
  templateKey: string;
  channel: ChannelType;
  locale: string;
  subject: string;
  html: string;
  text: string;
  variables: { name: string; required: boolean }[];
}

export interface TemplateDashboardPort {
  listTemplates(): Promise<{ templateKey: string; channels: string[]; locales: string[] }[]>;
  getTemplate(templateKey: string): Promise<{
    templateKey: string;
    versions: { versionId: string; channel: string; locale: string; subject: string; published: boolean }[];
  } | null>;
  upsertDraft(input: PublishTemplateInput): Promise<{ versionId: string }>;
  publishVersion(templateKey: string, versionId: string): Promise<void>;
}

export interface NotificationJobPort {
  processSend(dispatchId: string): Promise<{ status: string }>;
}
