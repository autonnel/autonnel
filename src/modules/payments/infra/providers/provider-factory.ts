import { StripeProviderAdapter } from './stripe-provider.adapter';
import { PayPalProviderAdapter } from './paypal-provider.adapter';
import type { PaymentProviderPort } from '../../application/ports/outbound';
import type { PspSlug } from '../../domain/value-objects';

export function createPaymentProvider(slug: PspSlug, config: Record<string, string>): PaymentProviderPort {
  if (slug === 'STRIPE') return new StripeProviderAdapter({ apiKey: config.secretKey });
  if (slug === 'PAYPAL') {
    // baseUrl is derived from mode unless explicitly set; sandbox creds against the live host fail auth.
    const baseUrl = config.baseUrl ?? (config.mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com');
    return new PayPalProviderAdapter({ clientId: config.clientId, clientSecret: config.clientSecret, baseUrl, webhookId: config.webhookId });
  }
  throw new Error(`Unknown PSP: ${slug}`);
}
