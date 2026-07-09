import type { APIRoute } from 'astro';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ShopPayPalOAuthRedirect');

export const GET: APIRoute = async ({ url }) => {
  logger.warn('Legacy PayPal OAuth redirect hit — rejected', { url: url.toString() });
  return new Response(
    'This endpoint is no longer in use. Use /api/settings/payment/paypal/oauth-initiate from the admin UI.',
    { status: 410, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
