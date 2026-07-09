


import type { APIRoute } from 'astro';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ShopPayPalOAuthCallback');

const GONE_BODY =
  'This endpoint is no longer in use. PayPal connect now runs on the admin domain at /api/settings/payment/paypal/oauth-callback. Update your PayPal app redirect URI.';

export const GET: APIRoute = async ({ url, request }) => {
  logger.warn('Legacy PayPal OAuth callback hit — rejected', {
    fullUrl: url.toString(),
    referer: request.headers.get('referer') || null,
  });
  return new Response(GONE_BODY, {
    status: 410,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
