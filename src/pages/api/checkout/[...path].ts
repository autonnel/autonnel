import type { APIContext } from 'astro';
import { makeStorefrontCheckout } from '@/composition/make-storefront-checkout';
import { storefrontCheckoutDepsFromLocals } from '@/composition/storefront-runtime';
import { handleCheckoutRequest } from '@/modules/storefront-checkout/infra/checkout-api-adapter';
import { resolveCheckoutLocale } from '@/modules/storefront-checkout/application/resolve-locale';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';
import { createLogger } from '@/lib/logger';

export const prerender = false;

const logger = createLogger('CheckoutApiRoute');

const COOKIE = 'an_checkout_session';
const ATTRIBUTION_TTL_SEC = 60 * 60 * 24 * 30;

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function readSessionCookie(request: Request): string | null {
  return readCookie(request, COOKIE);
}

// Bridges the first-touch attribution stored under the visitor anid to the checkout
// sessionId so recordConversion can resolve click identifiers for the sale.
async function bridgeAttribution(context: APIContext, anid: string, sessionId: string): Promise<void> {
  const ads = await makeAcquisitionAds(await createAdsDepsForRequest(context.locals));
  const touch = await ads.attributionStore.get(`attr:${anid}`);
  if (!touch) return;
  await ads.attributionStore.put({ key: `attr:${sessionId}`, touch, ttlSec: ATTRIBUTION_TTL_SEC });
}

// Unauthenticated shopper endpoint: the signed session cookie is the only credential.
export async function POST(context: APIContext): Promise<Response> {
  const action = context.params['path'] ?? '';
  const body = (await context.request.json().catch(() => ({}))) as Record<string, any>;
  const cookie = readSessionCookie(context.request);

  if (action === 'submit') {
    body.visitorId = readCookie(context.request, 'anid');
    body.locale = resolveCheckoutLocale({
      explicit: typeof body.locale === 'string' ? body.locale : null,
      acceptLanguage: context.request.headers.get('accept-language'),
    });
  }

  const surface = makeStorefrontCheckout(storefrontCheckoutDepsFromLocals(context.locals));
  const result = await handleCheckoutRequest(action, body, cookie, surface);

  if (action === 'submit' && result.status === 200) {
    const sessionId = result.body.sessionId as string | undefined;
    const anid = readCookie(context.request, 'anid');
    if (anid && sessionId) {
      try {
        await bridgeAttribution(context, anid, sessionId);
      } catch (err) {
        logger.warn('Attribution bridge failed', { error: err });
      }
    }
  }

  const headers = new Headers({ 'content-type': 'application/json' });
  if (result.setSessionCookie) {
    headers.append(
      'Set-Cookie',
      `${COOKIE}=${encodeURIComponent(result.setSessionCookie)}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    );
  }
  return new Response(JSON.stringify(result.body), { status: result.status, headers });
}
