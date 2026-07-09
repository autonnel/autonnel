import type { APIContext } from 'astro';
import { Money } from '../../../modules/shared-kernel/money';
import { SaleRef, CaptureMethod } from '../../../modules/payments/domain/value-objects';
import { makePaymentsCommand } from '../../../composition/make-payments';
import { makeStorefrontCheckout } from '@/composition/make-storefront-checkout';
import { storefrontCheckoutDepsFromLocals } from '@/composition/storefront-runtime';
import type { PaymentIntentCommandPort } from '../../../modules/payments/application/ports/inbound';

export const prerender = false;

const SESSION_COOKIE = 'an_checkout_session';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export interface AuthoritativeAmount {
  amountMinor: number;
  currencyCode: string;
}

// Resolves the server-authoritative checkout total from a signed session cookie. Returns null
// when the cookie is absent/invalid so the route can reject before touching any payment provider.
export type ResolveAmount = (sessionCookie: string | null) => Promise<AuthoritativeAmount | null>;

// The amount charged is ALWAYS the server-recomputed total (cart + applied coupon), never the
// client-supplied amount; a mismatching client amount is rejected as tampering.
export async function handleCreateIntent(
  request: Request,
  service: PaymentIntentCommandPort,
  resolveAmount: ResolveAmount,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as any;
  if (!body?.saleRef) return json({ error: 'invalid_request' }, 400);

  const authoritative = await resolveAmount(readCookie(request, SESSION_COOKIE));
  if (!authoritative) return json({ error: 'invalid_session' }, 401);
  if (authoritative.amountMinor <= 0) return json({ error: 'empty_cart' }, 422);

  if (
    body.amountMinor !== undefined &&
    (body.amountMinor !== authoritative.amountMinor || body.currencyCode !== authoritative.currencyCode)
  ) {
    return json({ error: 'amount_mismatch' }, 409);
  }

  const out = await service.create({
    saleRef: SaleRef.of(body.saleRef),
    amount: Money.of(authoritative.amountMinor, authoritative.currencyCode),
    captureMethod: body.captureMethod === 'manual' ? CaptureMethod.MANUAL : CaptureMethod.AUTOMATIC,
    provider: body.provider,
  });
  return json(out, 200);
}

export async function POST(context: APIContext): Promise<Response> {
  const surface = makeStorefrontCheckout(storefrontCheckoutDepsFromLocals(context.locals));
  const resolveAmount: ResolveAmount = async (cookie) => {
    const sessionId = cookie ? await surface.sessions.verifyCookieValue(cookie) : null;
    if (!sessionId) return null;
    try {
      return await surface.quoteAuthoritativeTotal.execute(sessionId);
    } catch {
      // Empty cart / stale price: non-chargeable, rejected as empty_cart by the handler.
      return { amountMinor: 0, currencyCode: 'USD' };
    }
  };
  return handleCreateIntent(context.request, makePaymentsCommand() as any, resolveAmount);
}
