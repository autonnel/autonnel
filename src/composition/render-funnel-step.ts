import type { RenderStepResult } from '@/modules/storefront-checkout/application/ports/inbound';
import { makeStorefrontCheckout } from './make-storefront-checkout';
import { storefrontCheckoutDepsFromLocals } from './storefront-runtime';

const COOKIE = 'an_checkout_session';

export interface RenderStepForRequestResult extends RenderStepResult {
  setCookie: string | null;
}

function readSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export async function renderStepForRequest(
  stepSlug: string,
  cookieHeader: string | null,
  locals: unknown,
): Promise<RenderStepForRequestResult> {
  const surface = makeStorefrontCheckout(storefrontCheckoutDepsFromLocals(locals));
  const cookieValue = readSessionCookie(cookieHeader);
  const existing = cookieValue ? await surface.sessions.verifyCookieValue(cookieValue) : null;

  if (existing) {
    const result = await surface.renderStep.renderStep(stepSlug, cookieValue);
    return { ...result, setCookie: null };
  }

  const session = await surface.startSession.execute(stepSlug);
  const signed = await surface.sessions.signCookieValue(session.sessionId);
  const result = await surface.renderStep.renderStep(stepSlug, signed);
  const setCookie = `${COOKIE}=${encodeURIComponent(signed)}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  return { ...result, setCookie };
}
