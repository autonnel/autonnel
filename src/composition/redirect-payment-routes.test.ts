import { describe, it, expect, vi } from 'vitest';
import { handlePaymentReturn, handlePaymentWebhook } from './redirect-payment-routes';

function returnDeps(outcome: string, targets?: unknown) {
  return {
    targets: vi.fn(async () => targets as never),
    finalize: vi.fn(async () => outcome as never),
    afterCapture: vi.fn(async () => {}),
  };
}
const url = (q: string) => new URL(`https://shop.example/api/shop/payment/return/acme?${q}`);

describe('handlePaymentReturn', () => {
  it('redirects to next with orderId after capture', async () => {
    const d = returnDeps('captured');
    const res = await handlePaymentReturn(url('saleRef=s1&next=%2Fthanks%3Fx%3D1&page=p1&funnel=f1'), 'ACME', d);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/thanks?x=1&orderId=s1');
    expect(d.afterCapture).toHaveBeenCalledWith('s1');
  });

  it('keeps the buyer on the wait page when the provider lookup throws, then falls back to cancel', async () => {
    const d = { ...returnDeps('captured', { cancel: '/co' }), finalize: vi.fn(async () => { throw new Error('provider down'); }) };
    const res = await handlePaymentReturn(url('saleRef=s1'), 'ACME', d);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('attempt=1');
    const last = await handlePaymentReturn(url('saleRef=s1&attempt=20'), 'ACME', d);
    expect(last.headers.get('location')).toBe('/co?payment_error=1');
    expect(d.afterCapture).not.toHaveBeenCalled();
  });

  it('prefers stored targets over query params', async () => {
    const d = returnDeps('captured', { next: '/stored', pageId: 'p9', funnelId: 'f9' });
    const res = await handlePaymentReturn(url('saleRef=s1&next=%2Fquery&page=p1&funnel=f1'), 'ACME', d);
    expect(res.headers.get('location')).toBe('/stored?orderId=s1');
    expect(d.afterCapture).toHaveBeenCalledWith('s1');
  });

  it('uses stored cancel on failure', async () => {
    const res = await handlePaymentReturn(url('saleRef=s1'), 'ACME', returnDeps('failed', { cancel: '/co' }));
    expect(res.headers.get('location')).toBe('/co?payment_error=1');
  });

  it('rejects off-site stored targets', async () => {
    const res = await handlePaymentReturn(url('saleRef=s1&next=%2Fok'), 'ACME', returnDeps('captured', { next: 'https://evil.example/' }));
    expect(res.headers.get('location')).toBe('/thank-you?orderId=s1');
  });

  it('rejects off-site return targets', async () => {
    const res = await handlePaymentReturn(url('saleRef=s1&next=https%3A%2F%2Fevil.example%2F'), 'ACME', returnDeps('captured'));
    expect(res.headers.get('location')).toBe('/thank-you?orderId=s1');
  });

  it('sends the buyer back to checkout on failure', async () => {
    const res = await handlePaymentReturn(url('saleRef=s1&cancel=%2Fcheckout%3Fv%3D2'), 'ACME', returnDeps('failed'));
    expect(res.headers.get('location')).toBe('/checkout?v=2&payment_error=1');
  });

  it('treats an unknown sale like a failure', async () => {
    const res = await handlePaymentReturn(url('saleRef=s1&cancel=%2Fc'), 'ACME', returnDeps('not_found'));
    expect(res.headers.get('location')).toBe('/c?payment_error=1');
  });

  it('renders a self-refreshing wait page while pending and gives up after the limit', async () => {
    const pending = await handlePaymentReturn(url('saleRef=s1&cancel=%2Fc'), 'ACME', returnDeps('pending'));
    expect(pending.status).toBe(200);
    const html = await pending.text();
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain('attempt=1');
    const exhausted = await handlePaymentReturn(url('saleRef=s1&cancel=%2Fc&attempt=20'), 'ACME', returnDeps('pending'));
    expect(exhausted.headers.get('location')).toBe('/c?payment_error=1');
  });

  it('escapes the refresh url so query values cannot break out of the attribute', async () => {
    const res = await handlePaymentReturn(url('saleRef=s1&x=%22%3E%3Cscript%3E'), 'ACME', returnDeps('pending'));
    const html = await res.text();
    expect(html).not.toContain('<script>');
    expect(html).toContain('x=%22%3E%3Cscript%3E&amp;attempt=1');
  });

  it('400s without a saleRef', async () => {
    expect((await handlePaymentReturn(url(''), 'ACME', returnDeps('captured'))).status).toBe(400);
  });
});

describe('handlePaymentWebhook', () => {
  const req = (body: string) => new Request('https://shop.example/api/shop/payment/webhook/acme', { method: 'POST', body, headers: { 'X-PD-SIGN': 'sig' } });

  it('verifies, applies and returns the provider ack', async () => {
    const provider = {
      verifyWebhookSignature: vi.fn(async () => true),
      parseWebhook: vi.fn(() => ({ provider: 'ACME', providerEventId: 'e', type: 'payment', providerIntentId: 's1', status: 'CAPTURED' })),
      webhookAck: () => ({ status: 200, body: '{"roger":true}', contentType: 'application/json' }),
    };
    const apply = vi.fn(async () => 'captured' as const);
    const afterCapture = vi.fn(async () => {});
    const res = await handlePaymentWebhook(req('{"reqId":"s1"}'), 'ACME', { provider: async () => provider as never, apply, afterCapture });
    expect(provider.verifyWebhookSignature).toHaveBeenCalledWith('{"reqId":"s1"}', expect.objectContaining({ 'x-pd-sign': 'sig' }), '');
    expect(apply).toHaveBeenCalledOnce();
    expect(afterCapture).toHaveBeenCalledWith('s1');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"roger":true}');
  });

  it('401s on a bad signature without applying', async () => {
    const provider = { verifyWebhookSignature: vi.fn(async () => false), parseWebhook: vi.fn() };
    const apply = vi.fn();
    const res = await handlePaymentWebhook(req('{}'), 'ACME', { provider: async () => provider as never, apply, afterCapture: vi.fn() });
    expect(res.status).toBe(401);
    expect(apply).not.toHaveBeenCalled();
  });

  it('500s when the provider cannot be built', async () => {
    const res = await handlePaymentWebhook(req('{}'), 'ACME', { provider: async () => { throw new Error('not configured'); }, apply: vi.fn(), afterCapture: vi.fn() });
    expect(res.status).toBe(500);
  });

  it('500s when applying fails so the provider retries', async () => {
    const provider = { verifyWebhookSignature: vi.fn(async () => true), parseWebhook: vi.fn(() => ({ providerIntentId: 's1' })) };
    const res = await handlePaymentWebhook(req('{}'), 'ACME', { provider: async () => provider as never, apply: vi.fn(async () => { throw new Error('db'); }), afterCapture: vi.fn() });
    expect(res.status).toBe(500);
  });
});
