import { defineRoute } from '@/lib/api/define-route';
import { getConfig } from '@/lib/config/get-config';

// NEVER returns secrets.
export const GET = defineRoute('GET /api/shop/payment-config', {}, async () => {
  const cfg = (await getConfig('payment.config')) as { providers?: Record<string, any> } | null;
  const providers = cfg?.providers ?? {};
  return {
    stripe: providers.STRIPE
      ? { publishableKey: providers.STRIPE.publishableKey, enabled: providers.STRIPE.isActive !== false }
      : null,
    paypal: providers.PAYPAL
      ? { clientId: providers.PAYPAL.clientId, enabled: providers.PAYPAL.isActive !== false }
      : null,
  };
});
