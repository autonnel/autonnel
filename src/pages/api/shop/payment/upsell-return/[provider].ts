import type { APIRoute } from 'astro';
import { handleUpsellReturn } from '@/composition/hosted-upsell';
import { finalizeHostedUpsell, loadPendingHostedUpsell } from '@/composition/make-upsell';
import { getPluginPaymentProvider } from '@/lib/plugins/payment-providers';

export const prerender = false;

export const GET: APIRoute = async ({ params, url, locals }) => {
  if (!getPluginPaymentProvider((params.provider ?? '').toUpperCase())) return new Response('Not Found', { status: 404 });
  return handleUpsellReturn(url, {
    pending: loadPendingHostedUpsell,
    finalize: (saleRef, upsellIndex) => finalizeHostedUpsell(saleRef, upsellIndex, locals),
  });
};
