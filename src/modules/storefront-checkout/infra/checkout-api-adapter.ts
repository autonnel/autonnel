import { createLogger } from '@/lib/logger';

const logger = createLogger('CheckoutApi');

export interface CheckoutHttpResult {
  status: number;
  body: Record<string, unknown>;
  setSessionCookie?: string;
}

type Surface = ReturnType<typeof import('@/composition/make-storefront-checkout').makeStorefrontCheckout>;

const REQUIRES_SESSION = new Set(['cart', 'coupon', 'submit', 'upsell', 'advance']);

export async function handleCheckoutRequest(
  action: string,
  body: Record<string, any>,
  cookie: string | null,
  surface: Surface,
): Promise<CheckoutHttpResult> {
  let sessionId: string | null = null;
  if (REQUIRES_SESSION.has(action)) {
    sessionId = cookie ? await surface.sessions.verifyCookieValue(cookie) : null;
    if (!sessionId) return { status: 401, body: { error: 'invalid_session' } };
  }

  try {
    switch (action) {
      case 'session': {
        const session = await surface.startSession.execute(body.stepSlug);
        return { status: 200, body: { sessionId: session.sessionId, currentStep: session.currentStep.value }, setSessionCookie: await surface.sessions.signCookieValue(session.sessionId) };
      }
      case 'cart':
        await surface.addToCart.execute(sessionId!, { variantExternalId: body.variantExternalId, quantity: body.quantity });
        return { status: 200, body: { ok: true } };
      case 'coupon':
        return { status: 200, body: await surface.applyCoupon.execute(sessionId!, body.code) };
      case 'submit': {
        const result = await surface.submitCheckout.execute({ sessionId: sessionId!, buyer: body.buyer, captureMethod: body.captureMethod, visitorId: body.visitorId ?? null, provider: body.provider, locale: body.locale ?? null });
        return { status: 200, body: { ...(result as object), sessionId } };
      }
      case 'upsell':
        return { status: 200, body: await surface.oneClickUpsell.execute(sessionId!, { variantExternalId: body.variantExternalId, quantity: body.quantity }) };
      case 'advance':
        return { status: 200, body: { nextStep: await surface.advanceStep.execute(sessionId!, body.outcome) } };
      default:
        return { status: 400, body: { error: 'unknown_action' } };
    }
  } catch (err) {
    logger.warn('Checkout action failed', { action, error: err });
    return { status: 422, body: { error: 'checkout_failed', message: (err as Error).message } };
  }
}
