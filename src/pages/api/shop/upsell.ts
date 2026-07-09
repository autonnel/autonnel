import type { APIRoute } from 'astro';
import { acceptUpsell, declineUpsell } from '@/composition/make-upsell';
import type { ShopUpsellInput, ShopUpsellDto } from '@/contracts/shop';
import { createLogger } from '@/lib/logger';

export const prerender = false;

const logger = createLogger('ShopUpsell');

function json(body: ShopUpsellDto, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Public shopper endpoint: one-click post-purchase upsell accept/decline for a paid order.
export const POST: APIRoute = async ({ request, locals }) => {
  const body = (await request.json().catch(() => ({}))) as Partial<ShopUpsellInput>;
  if (!body.parentOrderId || !body.trackingId || (body.action !== 'accept' && body.action !== 'decline')) {
    return json({ success: false, error: 'parentOrderId, trackingId and a valid action are required' }, 400);
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
