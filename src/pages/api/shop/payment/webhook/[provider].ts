import type { APIRoute } from 'astro';
import { makeCompleteRedirectPayment, resolvePaymentProvider } from '@/composition/make-payments';
import { runCheckoutDrain } from '@/composition/run-checkout-drain';
import { handlePaymentWebhook } from '@/composition/redirect-payment-routes';
import { getPluginPaymentProvider } from '@/lib/plugins/payment-providers';
import { getCurrentTenantId } from '@/lib/tenant/context';

export const prerender = false;

// Public provider notification endpoint; authenticity comes only from the provider signature.
export const POST: APIRoute = async ({ params, request, locals }) => {
  const slug = (params.provider ?? '').toUpperCase();
  if (!getPluginPaymentProvider(slug)) return new Response('Not Found', { status: 404 });
  const service = makeCompleteRedirectPayment();
  return handlePaymentWebhook(request, slug, {
    provider: resolvePaymentProvider,
    apply: (s, parsed) => service.applyWebhook(s, parsed),
    afterCapture: (saleRef) => runCheckoutDrain(getCurrentTenantId(), saleRef, locals),
  });
};
