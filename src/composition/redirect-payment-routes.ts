import type { ParsedWebhook, PaymentProviderPort } from '@/modules/payments/application/ports/outbound';
import type { RedirectOutcome } from '@/modules/payments/application/complete-redirect-payment.service';
import { safeLocalPath, type ReturnTargets } from './payment-request-context';
import { createLogger } from '@/lib/logger';

const logger = createLogger('RedirectPaymentRoutes');
export const MAX_WAIT_ATTEMPTS = 20;
const WAIT_SECONDS = 3;

export interface ReturnDeps {
  targets(saleRef: string): Promise<ReturnTargets | undefined>;
  finalize(saleRef: string): Promise<RedirectOutcome>;
  afterCapture(saleRef: string): Promise<void>;
}

export interface WebhookDeps {
  provider(slug: string): Promise<PaymentProviderPort>;
  apply(slug: string, parsed: ParsedWebhook): Promise<'captured' | 'ignored'>;
  afterCapture(saleRef: string): Promise<void>;
}

export function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

export function withParam(path: string, key: string, value: string): string {
  const u = new URL(path, 'https://local.invalid');
  u.searchParams.set(key, value);
  return `${u.pathname}${u.search}`;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function waitPage(next: URL): Response {
  const href = escapeAttribute(`${next.pathname}${next.search}`);
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="${WAIT_SECONDS};url=${href}"><title>Processing payment</title></head><body style="font:15px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#0f172a"><p>Confirming your payment, please wait...</p></body></html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// A provider error on return must not strand the buyer on a 500: keep the wait page polling and let
// the reconciliation cron settle the payment if the provider stays unavailable.
export async function settleOrWait<T extends string>(finalize: () => Promise<T>, context: Record<string, unknown>): Promise<T | 'pending'> {
  try {
    return await finalize();
  } catch (error) {
    logger.error('Redirect payment lookup failed on return', { ...context, error });
    return 'pending';
  }
}

// The provider's own `status` query parameter is ignored: only the server-side query decides.
export async function handlePaymentReturn(url: URL, slug: string, deps: ReturnDeps): Promise<Response> {
  const saleRef = url.searchParams.get('saleRef');
  if (!saleRef) return new Response('saleRef is required', { status: 400 });
  const stored = await deps.targets(saleRef);
  const next = safeLocalPath(stored?.next ?? url.searchParams.get('next'), '/thank-you');
  const cancel = safeLocalPath(stored?.cancel ?? url.searchParams.get('cancel'), '/');
  const attempt = Number(url.searchParams.get('attempt') ?? '0') || 0;

  const outcome = await settleOrWait(() => deps.finalize(saleRef), { slug, saleRef });
  if (outcome === 'captured') {
    await deps.afterCapture(saleRef);
    return redirect(withParam(next, 'orderId', saleRef));
  }
  if (outcome === 'pending' && attempt < MAX_WAIT_ATTEMPTS) {
    const again = new URL(url.toString());
    again.searchParams.set('attempt', String(attempt + 1));
    return waitPage(again);
  }
  logger.info('Redirect payment not completed on return', { slug, saleRef, outcome, attempt });
  return redirect(withParam(cancel, 'payment_error', '1'));
}

export async function handlePaymentWebhook(request: Request, slug: string, deps: WebhookDeps): Promise<Response> {
  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
  let provider: PaymentProviderPort;
  try {
    provider = await deps.provider(slug);
    if (!(await provider.verifyWebhookSignature(rawBody, headers, ''))) {
      logger.warn('Payment notification rejected: bad signature', { slug });
      return new Response('invalid signature', { status: 401 });
    }
    const parsed = provider.parseWebhook(rawBody);
    const result = await deps.apply(slug, parsed);
    if (result === 'captured' && parsed.providerIntentId) await deps.afterCapture(parsed.providerIntentId);
  } catch (error) {
    logger.error('Payment notification processing failed', { slug, error });
    return new Response('retry', { status: 500 });
  }
  const ack = provider.webhookAck?.() ?? { status: 200, body: 'OK' };
  return new Response(ack.body, { status: ack.status, headers: { 'Content-Type': ack.contentType ?? 'text/plain' } });
}
