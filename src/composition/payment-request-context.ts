import { getClientIp } from '@/lib/api/client-ip';
import type { CheckoutSnapshot } from '@/modules/storefront-checkout/application/checkout-snapshot';
import type { PaymentRequestContext } from '@/modules/payments/application/ports/outbound';

export interface CheckoutRequestInfo {
  origin: string;
  clientIp?: string;
  userAgent?: string;
  returnTo?: string;
  cancelTo?: string;
  pageId?: string;
  funnelId?: string;
}

export interface ReturnTargets { next?: string; cancel?: string; pageId?: string; funnelId?: string }

export function returnTargetsOf(request?: CheckoutRequestInfo): ReturnTargets | undefined {
  if (!request) return undefined;
  const { returnTo: next, cancelTo: cancel, pageId, funnelId } = request;
  if (!next && !cancel && !pageId && !funnelId) return undefined;
  return { next, cancel, pageId, funnelId };
}

// Providers cap the return URL length, so the buyer's destinations travel with the intent instead of the URL.
export function snapshotWithReturnTargets(snapshot: CheckoutSnapshot | undefined, request?: CheckoutRequestInfo): CheckoutSnapshot | undefined {
  const returnTargets = returnTargetsOf(request);
  return returnTargets ? ({ ...snapshot, returnTargets } as CheckoutSnapshot) : snapshot;
}

// Same-site path only: rejects absolute, protocol-relative, backslash and control-character targets
// (browsers strip tab/CR/LF, so "/\t/host" would become "//host").
export function safeLocalPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}

function optionalLocalPath(value: unknown): string | undefined {
  const path = safeLocalPath(value, '');
  return path || undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function resolveClientIp(request: Request, clientAddress: string | undefined): string | undefined {
  const ip = getClientIp(request);
  return ip === 'unknown' ? clientAddress : ip;
}

// Behind a TLS-terminating proxy request.url is http://; providers require the public scheme.
function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (proto === 'http' || proto === 'https') url.protocol = proto;
  return url.origin;
}

export function checkoutRequestInfo(request: Request, clientAddress: string | undefined, body: Record<string, unknown>): CheckoutRequestInfo {
  return {
    origin: publicOrigin(request),
    clientIp: resolveClientIp(request, clientAddress),
    userAgent: request.headers.get('user-agent') ?? undefined,
    returnTo: optionalLocalPath(body.returnTo),
    cancelTo: optionalLocalPath(body.cancelTo),
    pageId: optionalString(body.pageId),
    funnelId: optionalString(body.funnelId),
  };
}

export function buildPaymentRequestContext(input: { slug: string; saleRef: string; snapshot?: CheckoutSnapshot; request?: CheckoutRequestInfo }): PaymentRequestContext {
  const { snapshot, request } = input;
  const buyer = snapshot?.buyer;
  const context: PaymentRequestContext = {
    buyer: {
      email: buyer?.channel === 'email' ? buyer.normalized : undefined,
      phone: buyer?.channel === 'phone' ? buyer.normalized : undefined,
      fullName: buyer?.fullName || undefined,
      shopperId: buyer?.hashedIdentity,
      address: buyer?.address as PaymentRequestContext['buyer']['address'],
    },
    lines: (snapshot?.lines ?? []).map((l) => ({ sku: l.variantExternalId, title: l.title, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, currencyCode: l.currencyCode })),
    sessionId: snapshot?.sessionId,
    locale: snapshot?.locale ?? null,
    clientIp: request?.clientIp,
    userAgent: request?.userAgent,
  };
  if (!request) return context;

  const slug = input.slug.toLowerCase();
  const ret = new URL(`/api/shop/payment/return/${slug}`, request.origin);
  ret.searchParams.set('saleRef', input.saleRef);
  context.returnUrl = ret.toString();
  context.notifyUrl = new URL(`/api/shop/payment/webhook/${slug}`, request.origin).toString();
  return context;
}
