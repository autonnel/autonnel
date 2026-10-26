import { httpError, type ProviderHttpError } from './types';
import type { MessageDeliveryProviderPort, SendEmailInput, SendEmailResult, DeliveryReceiptEvent } from '../../application/ports/outbound';

export const CLOUDFLARE_EMAIL_BINDING = 'EMAIL';

type EmailAddress = { email: string; name: string };

export interface SendEmailBinding {
  send(message: {
    to: string;
    from: string | EmailAddress;
    replyTo?: string;
    subject: string;
    html?: string;
    text?: string;
    headers?: Record<string, string>;
  }): Promise<{ messageId: string }>;
}

export interface CloudflareEmailConfig {
  binding?: SendEmailBinding;
  accountId?: string;
  apiToken?: string;
  baseUrl?: string;
}

const RETRYABLE_CODES = new Set(['E_RATE_LIMIT_EXCEEDED', 'E_DAILY_LIMIT_EXCEEDED', 'E_INTERNAL_SERVER_ERROR']);

function bindingError(err: unknown): ProviderHttpError {
  const code = (err as { code?: unknown })?.code;
  const message = `cloudflare email send failed: ${typeof code === 'string' ? code : (err as Error)?.message ?? String(err)}`;
  if (typeof code !== 'string') {
    const e = httpError(message);
    e.network = true;
    return e;
  }
  return httpError(message, RETRYABLE_CODES.has(code) ? 429 : 422);
}

// Uses the Workers `send_email` binding when the runtime has one, otherwise the REST API (Node deployments).
// Cloudflare exposes no delivery-receipt webhook, so bounces never reach the suppression list.
export class CloudflareEmailAdapter implements MessageDeliveryProviderPort {
  readonly slug = 'cloudflare';
  constructor(private readonly config: CloudflareEmailConfig) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (this.config.binding) return this.sendViaBinding(this.config.binding, input);
    if (this.config.accountId && this.config.apiToken) return this.sendViaRest(input);
    throw httpError(`cloudflare email: no "${CLOUDFLARE_EMAIL_BINDING}" send_email binding and no accountId/apiToken configured`, 422);
  }

  async parseWebhook(): Promise<DeliveryReceiptEvent[]> {
    return [];
  }

  private async sendViaBinding(binding: SendEmailBinding, input: SendEmailInput): Promise<SendEmailResult> {
    try {
      const result = await binding.send({
        to: input.to,
        from: input.fromName ? { email: input.from, name: input.fromName } : input.from,
        replyTo: input.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        headers: input.headers,
      });
      return { providerMessageId: result.messageId };
    } catch (err) {
      throw bindingError(err);
    }
  }

  private async sendViaRest(input: SendEmailInput): Promise<SendEmailResult> {
    const base = this.config.baseUrl ?? 'https://api.cloudflare.com/client/v4';
    const res = await fetch(`${base}/accounts/${this.config.accountId}/email/sending/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: input.to,
        from: input.fromName ? { address: input.from, name: input.fromName } : input.from,
        reply_to: input.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        headers: input.headers,
      }),
    });
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      errors?: Array<{ code: number; message: string }>;
      result?: { message_id?: string; permanent_bounces?: string[] };
    } | null;
    if (!res.ok || !json?.success) {
      const detail = json?.errors?.map((e) => `${e.code} ${e.message}`).join('; ') ?? '';
      throw httpError(`cloudflare email send failed: ${res.status} ${detail}`.trim(), res.ok ? 422 : res.status);
    }
    if (json.result?.permanent_bounces?.length) {
      throw httpError(`cloudflare email permanently bounced: ${json.result.permanent_bounces.join(', ')}`, 422);
    }
    return { providerMessageId: json.result?.message_id ?? `cf_${crypto.randomUUID()}` };
  }
}
