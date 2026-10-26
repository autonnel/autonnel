import { ResendEmailAdapter } from './resend.adapter';
import { PostmarkEmailAdapter } from './postmark.adapter';
import { SesHttpEmailAdapter } from './ses.adapter';
import { CloudflareEmailAdapter, CLOUDFLARE_EMAIL_BINDING, type SendEmailBinding } from './cloudflare.adapter';
import { getBinding } from '@/lib/runtime/env';
import type { MessageDeliveryProviderPort } from '../../application/ports/outbound';

export { ResendEmailAdapter, PostmarkEmailAdapter, SesHttpEmailAdapter, CloudflareEmailAdapter };

export function createDeliveryProvider(slug: string, config: Record<string, unknown>): MessageDeliveryProviderPort {
  switch (slug.toLowerCase()) {
    case 'resend': return new ResendEmailAdapter({ apiKey: String(config.apiKey) });
    case 'postmark': return new PostmarkEmailAdapter({ serverToken: String(config.serverToken) });
    case 'ses': return new SesHttpEmailAdapter({ region: String(config.region), accessKeyId: String(config.accessKeyId), secretAccessKey: String(config.secretAccessKey) });
    case 'cloudflare': return new CloudflareEmailAdapter({
      binding: getBinding<SendEmailBinding>(CLOUDFLARE_EMAIL_BINDING),
      accountId: config.accountId ? String(config.accountId) : undefined,
      apiToken: config.apiToken ? String(config.apiToken) : undefined,
    });
    default: throw new Error(`unknown email provider: ${slug}`);
  }
}
