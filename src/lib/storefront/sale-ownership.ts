import { makeStorefrontCheckout } from '@/composition/make-storefront-checkout';
import { storefrontCheckoutDepsFromLocals } from '@/composition/storefront-runtime';

const SESSION_COOKIE = 'an_checkout_session';

// Uniform shopper-facing message: never reveal whether the sale exists.
export const SALE_OWNERSHIP_DENIED = 'This checkout session cannot act on that order';

export function readCookieValue(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

// A saleRef travels in the browser URL after checkout, so it is an identifier, never a credential.
// The only proof of ownership is the HMAC-signed session cookie whose FunnelSession linked the sale.
export async function ownsSale(request: Request, locals: unknown, saleRef: string): Promise<boolean> {
  if (!saleRef) return false;
  const cookieValue = readCookieValue(request, SESSION_COOKIE);
  if (!cookieValue) return false;

  const { sessions } = makeStorefrontCheckout(storefrontCheckoutDepsFromLocals(locals));
  const sessionId = await sessions.verifyCookieValue(cookieValue);
  if (!sessionId) return false;

  const session = await sessions.load(sessionId);
  return session?.linkedSaleId === saleRef;
}
