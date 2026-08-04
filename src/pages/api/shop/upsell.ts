import type { APIRoute } from 'astro';
import { acceptUpsell, declineUpsell } from '@/composition/make-upsell';
import { ownsSale, SALE_OWNERSHIP_DENIED } from '@/lib/storefront/sale-ownership';
import type { ShopUpsellInput, ShopUpsellDto } from '@/contracts/shop';
import { createLogger } from '@/lib/logger';

export const prerender = false;

const logger = createLogger('ShopUpsell');

function json(body: ShopUpsellDto, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Public shopper endpoint: one-click post-purchase upsell accept/decline for a paid order.
// parentOrderId travels in the browser URL after checkout, so it authorizes nothing — the signed
// checkout-session cookie must link exactly this sale before any charge, PATCH or capture.
export const POST: APIRoute = async ({ request, locals }) => {
  const body = (await request.json().catch(() => ({}))) as Partial<ShopUpsellInput>;
  if (!body.parentOrderId || !body.trackingId || (body.action !== 'accept' && body.action !== 'decline')) {
    return json({ success: false, error: 'parentOrderId, trackingId and a valid action are required' }, 400);
  }
  if (!(await ownsSale(request, locals, body.parentOrderId))) {
    logger.warn('Upsell rejected: checkout session does not own the sale', {
      saleRef: body.parentOrderId,
      action: body.action,
    });
    return json({ success: false, error: SALE_OWNERSHIP_DENIED }, 403);
  }
  try {
    const input = body as ShopUpsellInput;
    const dto = input.action === 'accept' ? await acceptUpsell(input, locals) : await declineUpsell(input, locals);
    return json(dto);
  } catch (err) {
    logger.error('Upsell request failed', { error: err, saleRef: body.parentOrderId, action: body.action });
    return json({ success: false, error: 'Something went wrong processing the offer' });
  }
};
