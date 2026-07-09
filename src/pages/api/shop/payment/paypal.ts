import type { APIRoute } from 'astro';
import { makeConfirmPayPalOrder } from '@/composition/make-payments';
import { runCheckoutDrain } from '@/composition/run-checkout-drain';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { funnelNextStepIsUpsell } from '@/lib/funnel-next-step';
import type { ShopPayPalPaymentInput, ShopPayPalPaymentDto } from '@/contracts/shop';
import { createLogger } from '@/lib/logger';

export const prerender = false;

const logger = createLogger('ShopPaymentPayPal');

function json(body: ShopPayPalPaymentDto, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Public shopper endpoint: captures an approved PayPal order or records a client-side error.
export const POST: APIRoute = async ({ request, locals }) => {
  const body = (await request.json().catch(() => ({}))) as Partial<ShopPayPalPaymentInput> & { payerId?: string };
  const { orderId, payerId, error, funnelId, pageId } = body;
  const action = body.action as string | undefined;

  if (!orderId) return json({ success: false, error: 'orderId is required' });

  if (action === 'save-error') {
    logger.warn('PayPal client error reported', { orderId, error });
    return json({ success: true, orderId });
  }

  if (action === 'approve' || action === 'approved') {
    try {
      // Hold capture when an upsell follows checkout so it can be merged into this same order;
      // capture immediately otherwise (unchanged behavior for plain funnels).
      const defer = pageId ? await funnelNextStepIsUpsell(pageId, funnelId ?? null).catch(() => false) : false;
      const result = await makeConfirmPayPalOrder().approve({ saleRef: orderId, payerId, defer });
      if (result.status === 'succeeded') {
        // Deferred orders have no captured payment yet — nothing to drain into an order.
        if (!('deferred' in result && result.deferred)) {
          await runCheckoutDrain(getCurrentTenantId(), orderId, locals);
        }
        return json({ success: true, status: 'succeeded', orderId, redirectUrl: '' });
      }
      return json({ success: false, error: result.error, orderId });
    } catch (err) {
      logger.error('PayPal capture failed', { error: err, orderId });
      return json({ success: false, error: 'payment_error', orderId });
    }
  }

  return json({ success: false, error: 'Unknown action' });
};
