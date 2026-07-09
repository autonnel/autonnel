import { httpError } from './types';
import type { MessageDeliveryProviderPort, SendEmailInput, SendEmailResult, DeliveryReceiptEvent } from '../../application/ports/outbound';

export interface PostmarkConfig {
  serverToken: string;
  baseUrl?: string;
}

export class PostmarkEmailAdapter implements MessageDeliveryProviderPort {
  readonly slug = 'postmark';
  constructor(private readonly config: PostmarkConfig) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const base = this.config.baseUrl ?? 'https://api.postmarkapp.com';
    const res = await fetch(`${base}/email`, {
      method: 'POST',
      headers: { 'X-Postmark-Server-Token': this.config.serverToken, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        From: input.fromName ? `${input.fromName} <${input.from}>` : input.from,
        To: input.to,
        ReplyTo: input.replyTo,
        Subject: input.subject,
        HtmlBody: input.html,
        TextBody: input.text,
        Headers: Object.entries(input.headers).map(([Name, Value]) => ({ Name, Value })),
      }),
    });
    if (!res.ok) throw httpError(`postmark send failed: ${res.status}`, res.status);
    const json = (await res.json()) as { MessageID: string; ErrorCode: number; Message?: string };
    if (json.ErrorCode !== 0) throw httpError(`postmark error ${json.ErrorCode}: ${json.Message}`, 422);
    return { providerMessageId: json.MessageID };
  }

  async parseWebhook(payload: unknown): Promise<DeliveryReceiptEvent[]> {
    const p = payload as { RecordType: string; MessageID: string; Recipient?: string; Email?: string; Type?: string; DeliveredAt?: string; BouncedAt?: string };
    const recipient = p.Recipient ?? p.Email ?? '';
    const occurredAt = new Date(p.DeliveredAt ?? p.BouncedAt ?? Date.now());
    switch (p.RecordType) {
      case 'Delivery':
        return [{ providerMessageId: p.MessageID, kind: 'DELIVERED', recipient, occurredAt }];
      case 'Bounce':
        return [{ providerMessageId: p.MessageID, kind: p.Type === 'HardBounce' ? 'HARD_BOUNCE' : 'SOFT_BOUNCE', recipient, occurredAt }];
      case 'SpamComplaint':
        return [{ providerMessageId: p.MessageID, kind: 'COMPLAINT', recipient, occurredAt }];
      case 'Open':
        return [{ providerMessageId: p.MessageID, kind: 'OPENED', recipient, occurredAt }];
      case 'Click':
        return [{ providerMessageId: p.MessageID, kind: 'CLICKED', recipient, occurredAt }];
      default:
        return [];
    }
  }
}
