import { httpError } from './types';
import type { MessageDeliveryProviderPort, SendEmailInput, SendEmailResult, DeliveryReceiptEvent } from '../../application/ports/outbound';

export interface ResendConfig {
  apiKey: string;
  baseUrl?: string;
}

const RECEIPT_KINDS: Record<string, DeliveryReceiptEvent['kind']> = {
  'email.delivered': 'DELIVERED',
  'email.bounced': 'HARD_BOUNCE',
  'email.complained': 'COMPLAINT',
  'email.opened': 'OPENED',
  'email.clicked': 'CLICKED',
};

export class ResendEmailAdapter implements MessageDeliveryProviderPort {
  readonly slug = 'resend';
  constructor(private readonly config: ResendConfig) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const base = this.config.baseUrl ?? 'https://api.resend.com';
    const res = await fetch(`${base}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: input.fromName ? `${input.fromName} <${input.from}>` : input.from,
        to: [input.to],
        reply_to: input.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        headers: input.headers,
      }),
    });
    if (!res.ok) throw httpError(`resend send failed: ${res.status}`, res.status);
    const json = (await res.json()) as { id: string };
    return { providerMessageId: json.id };
  }

  async parseWebhook(payload: unknown): Promise<DeliveryReceiptEvent[]> {
    const p = payload as { type: string; data: { email_id: string; to?: string[]; bounce?: { type?: string } }; created_at: string };
    const kind = RECEIPT_KINDS[p.type];
    if (!kind) return [];
    return [{
      providerMessageId: p.data.email_id,
      kind: kind === 'HARD_BOUNCE' && p.data.bounce?.type && p.data.bounce.type !== 'hard' ? 'SOFT_BOUNCE' : kind,
      recipient: p.data.to?.[0] ?? '',
      occurredAt: new Date(p.created_at),
    }];
  }
}
