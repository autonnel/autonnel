import { ResendEmailAdapter } from './resend.adapter';
import { PostmarkEmailAdapter } from './postmark.adapter';
import { SesHttpEmailAdapter } from './ses.adapter';
import type { MessageDeliveryProviderPort } from '../../application/ports/outbound';

export { ResendEmailAdapter, PostmarkEmailAdapter, SesHttpEmailAdapter };

export function createDeliveryProvider(slug: string, config: Record<string, unknown>): MessageDeliveryProviderPort {
  switch (slug.toLowerCase()) {
    case 'resend': return new ResendEmailAdapter({ apiKey: String(config.apiKey) });
    case 'postmark': return new PostmarkEmailAdapter({ serverToken: String(config.serverToken) });
    case 'ses': return new SesHttpEmailAdapter({ region: String(config.region), accessKeyId: String(config.accessKeyId), secretAccessKey: String(config.secretAccessKey) });
    default: throw new Error(`unknown email provider: ${slug}`);
  }
}
