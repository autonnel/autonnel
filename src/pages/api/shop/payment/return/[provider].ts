import type { APIRoute } from 'astro';
import { makeCompleteRedirectPayment } from '@/composition/make-payments';
import { runCheckoutDrain } from '@/composition/run-checkout-drain';
import { handlePaymentReturn } from '@/composition/redirect-payment-routes';
import type { ReturnTargets } from '@/composition/payment-request-context';
import { PrismaPaymentIntentRepository } from '@/modules/payments/infra/prisma/payment-intent.repository';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { getPluginPaymentProvider } from '@/lib/plugins/payment-providers';
import { getCurrentTenantId } from '@/lib/tenant/context';

export const prerender = false;

const TARGET_KEYS = ['next', 'cancel', 'pageId', 'funnelId'] as const;

async function storedTargets(saleRef: string): Promise<ReturnTargets | undefined> {
  const intent = await new PrismaPaymentIntentRepository(getTenantPrisma()).findBySaleRef(saleRef);
  const raw = (intent?.checkoutSnapshot as { returnTargets?: Record<string, unknown> } | null | undefined)?.returnTargets;
  if (!raw || typeof raw !== 'object') return undefined;
  const targets: ReturnTargets = {};
  for (const key of TARGET_KEYS) if (typeof raw[key] === 'string') targets[key] = raw[key] as string;
  return targets;
}

export const GET: APIRoute = async ({ params, url, locals }) => {
  const slug = (params.provider ?? '').toUpperCase();
  if (!getPluginPaymentProvider(slug)) return new Response('Not Found', { status: 404 });
  const service = makeCompleteRedirectPayment();
  return handlePaymentReturn(url, slug, {
    targets: storedTargets,
    finalize: (saleRef) => service.finalizeBySaleRef(saleRef),
    afterCapture: (saleRef) => runCheckoutDrain(getCurrentTenantId(), saleRef, locals),
  });
};
