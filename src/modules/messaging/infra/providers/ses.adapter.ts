import { signAwsV4 } from './sigv4';
import { httpError } from './types';
import type { MessageDeliveryProviderPort, SendEmailInput, SendEmailResult, DeliveryReceiptEvent } from '../../application/ports/outbound';

export interface SesConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export class SesHttpEmailAdapter implements MessageDeliveryProviderPort {
  readonly slug = 'ses';
  constructor(private readonly config: SesConfig) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const host = `email.${this.config.region}.amazonaws.com`;
    const path = '/v2/email/outbound-emails';
    const body = JSON.stringify({
      FromEmailAddress: input.fromName ? `${input.fromName} <${input.from}>` : input.from,
      Destination: { ToAddresses: [input.to] },
      ReplyToAddresses: input.replyTo ? [input.replyTo] : undefined,
      Content: { Simple: { Subject: { Data: input.subject }, Body: { Html: { Data: input.html }, Text: { Data: input.text } } } },
    });
    const headers = await signAwsV4({
      method: 'POST', host, region: this.config.region, service: 'ses', path, body,
      accessKeyId: this.config.accessKeyId, secretAccessKey: this.config.secretAccessKey, now: new Date(),
    });
    const res = await fetch(`https://${host}${path}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body });
    if (!res.ok) throw httpError(`ses send failed: ${res.status}`, res.status);
    const json = (await res.json()) as { MessageId: string };
    return { providerMessageId: json.MessageId };
  }

  // SES delivery notifications arrive via SNS (configured out-of-band); the SNS payload body is the event.
  async parseWebhook(payload: unknown): Promise<DeliveryReceiptEvent[]> {
    const p = payload as { eventType?: string; mail?: { messageId: string }; bounce?: { bounceType: string }; delivery?: unknown; complaint?: unknown };
    const messageId = p.mail?.messageId ?? '';
    if (!messageId) return [];
    const occurredAt = new Date();
    if (p.eventType === 'Delivery' || p.delivery) return [{ providerMessageId: messageId, kind: 'DELIVERED', recipient: '', occurredAt }];
    if (p.eventType === 'Bounce' || p.bounce) return [{ providerMessageId: messageId, kind: p.bounce?.bounceType === 'Permanent' ? 'HARD_BOUNCE' : 'SOFT_BOUNCE', recipient: '', occurredAt }];
    if (p.eventType === 'Complaint' || p.complaint) return [{ providerMessageId: messageId, kind: 'COMPLAINT', recipient: '', occurredAt }];
    return [];
  }
}
