import type { APIRoute } from 'astro';
import { makeConfirmCardPayment } from '@/composition/make-payments';
import { runCheckoutDrain } from '@/composition/run-checkout-drain';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { getBasePrisma } from '@/lib/db';
import { funnelNextStepIsUpsell } from '@/lib/funnel-next-step';
import { ownsSale, SALE_OWNERSHIP_DENIED } from '@/lib/storefront/sale-ownership';
import type { ShopStripePaymentInput, ShopStripePaymentDto } from '@/contracts/shop';
import { createLogger } from '@/lib/logger';

export const prerender = false;

const logger = createLogger('ShopPaymentStripe');

function json(body: ShopStripePaymentDto, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Hold the single ecommerce push when an upsell follows checkout so base + upsells push as ONE
// merged order (Stripe still charges separately per upsell). Set before the drain delivers the
// capture event. Non-upsell checkouts are untouched (push at checkout as before).
async function maybeDeferHandoff(saleRef: string, funnelId?: string, pageId?: string): Promise<void> {
  if (!pageId) return;
  try {
    if (await funnelNextStepIsUpsell(pageId, funnelId ?? null)) {
      await getBasePrisma().paymentIntent.update({
        where: { tenantId_saleRef: { tenantId: getCurrentTenantId(), saleRef } },
        data: { handoffDeferred: true },
      });
    }
  } catch (err) {
    logger.warn('Failed to set handoffDeferred; ecommerce push will proceed at checkout', { error: err, saleRef });
  }
}

// Public shopper endpoint: confirms / finalizes a Stripe PaymentIntent for an existing sale.
export const POST: APIRoute = async ({ request, locals }) => {
  const body = (await request.json().catch(() => ({}))) as Partial<ShopStripePaymentInput>;
  const { action, orderId, paymentMethodId, paymentIntentId, funnelId, pageId } = body;

  if (!orderId) return json({ success: false, error: 'orderId is required' });

  // orderId is the saleRef, which the post-checkout redirect places in the browser URL — it
  // identifies but never authorizes. Without this gate, anyone holding the URL could drive
  // another shopper's PaymentIntent and receive its 3DS client secret.
  if (!(await ownsSale(request, locals, orderId))) {
    logger.warn('Stripe payment action rejected: checkout session does not own the sale', { orderId, action });
    return json({ success: false, error: SALE_OWNERSHIP_DENIED, orderId }, 403);
  }

  try {
    const service = makeConfirmCardPayment();

    if (action === 'confirm') {
      if (!paymentMethodId) return json({ success: false, error: 'paymentMethodId is required' });
      const result = await service.confirm({ saleRef: orderId, paymentMethodId });
      if (result.status === 'requires_action') {
        return json({ success: true, requiresAction: true, clientSecret: result.clientSecret, orderId, redirectUrl: '' });
      }
      if (result.status === 'succeeded') {
        await maybeDeferHandoff(orderId, funnelId, pageId);
        await runCheckoutDrain(getCurrentTenantId(), orderId, locals);
        return json({ success: true, status: 'succeeded', orderId, redirectUrl: '' });
      }
      return json({ success: false, error: result.error, code: result.code, orderId });
    }

    if (action === 'finalize') {
      const result = await service.finalize({ saleRef: orderId, paymentIntentId });
      if (result.status === 'succeeded') {
        await maybeDeferHandoff(orderId, funnelId, pageId);
        await runCheckoutDrain(getCurrentTenantId(), orderId, locals);
        return json({ success: true, status: 'succeeded', orderId, redirectUrl: '' });
      }
      if (result.status === 'requires_action') {
        return json({ success: true, requiresAction: true, orderId, redirectUrl: '' });
      }
      return json({ success: false, error: result.error, code: result.code, orderId });
    }

    return json({ success: false, error: 'Unknown action' });
  } catch (error) {
    logger.error('Stripe payment action failed', { error, orderId, action });
    return json({ success: false, error: 'payment_error', orderId });
  }
};
