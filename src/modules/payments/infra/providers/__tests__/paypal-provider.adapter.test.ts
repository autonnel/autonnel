import { describe, it, expect, vi } from 'vitest';
import { PayPalProviderAdapter } from '../paypal-provider.adapter';
import { createPaymentProvider } from '../provider-factory';
import { StripeProviderAdapter } from '../stripe-provider.adapter';

const BASE = 'https://api-m.sandbox.paypal.com';

function routedFetch(routes: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'tok_1' }), { status: 200 });
    }
    for (const [match, body] of Object.entries(routes)) {
      if (u.includes(match)) return new Response(JSON.stringify(body), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  });
}

const cfg = (fetchFn: typeof fetch) => ({ clientId: 'cid', clientSecret: 'sec', baseUrl: BASE, webhookId: 'wh_1', fetchFn });

describe('PayPalProviderAdapter', () => {
  it('createIntent posts a CAPTURE order that requires immediate payment and returns an approval_url ClientHandle', async () => {
    let postBody: any;
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/v1/oauth2/token')) return new Response(JSON.stringify({ access_token: 'tok_1' }), { status: 200 });
      if (init?.method === 'POST') postBody = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ id: 'order_1', links: [{ rel: 'approve', href: 'https://paypal.com/approve/order_1' }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const adapter = new PayPalProviderAdapter(cfg(fetchFn));
    const out = await adapter.createIntent({ amountMinor: 1999, currencyCode: 'USD', captureMethod: 'automatic', idempotencyKey: 'k1', saleRef: 'sale_1' });
    expect(out.providerRef.providerIntentId).toBe('order_1');
    expect(out.clientHandle.kind).toBe('approval_url');
    expect(out.clientHandle.value).toBe('https://paypal.com/approve/order_1');
    expect(postBody.payment_source.paypal.experience_context.payment_method_preference).toBe('IMMEDIATE_PAYMENT_REQUIRED');
  });

  // Regression: with no injected fetchFn the default must invoke global fetch unbound. Node's fetch
  // tolerates any `this`; Workers rejects a non-global `this` with "Illegal invocation". The buggy
  // `?? fetch` default called it with this=adapter, which broke PayPal order creation in production.
  it('invokes global fetch with a Workers-safe this binding when no fetchFn is injected', async () => {
    const realFetch = globalThis.fetch;
    const strictFetch = function (this: unknown, url: string) {
      if (this !== undefined && this !== globalThis) {
        throw new TypeError('Illegal invocation: function called with incorrect `this` reference.');
      }
      const body = String(url).includes('/v1/oauth2/token')
        ? { access_token: 'tok_1' }
        : { id: 'order_1', links: [{ rel: 'approve', href: 'https://paypal.com/approve/order_1' }] };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    };
    globalThis.fetch = strictFetch as unknown as typeof fetch;
    try {
      const adapter = new PayPalProviderAdapter({ clientId: 'cid', clientSecret: 'sec', baseUrl: BASE, webhookId: 'wh_1' });
      const out = await adapter.createIntent({ amountMinor: 1999, currencyCode: 'USD', captureMethod: 'automatic', idempotencyKey: 'k1', saleRef: 'sale_1' });
      expect(out.providerRef.providerIntentId).toBe('order_1');
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('capture posts to the order capture endpoint and normalizes the capture', async () => {
    const fetchFn = routedFetch({
      '/capture': { purchase_units: [{ payments: { captures: [{ id: 'cap_1', amount: { value: '19.99', currency_code: 'USD' }, create_time: '2026-06-04T00:00:00Z' }] } }] },
    }) as unknown as typeof fetch;
    const adapter = new PayPalProviderAdapter(cfg(fetchFn));
    const out = await adapter.capture('order_1', 'k1');
    expect(out.providerChargeId).toBe('cap_1');
    expect(out.capturedAmountMinor).toBe(1999);
    expect(out.currencyCode).toBe('USD');
  });

  it('capture extracts the express payer (email, name, shipping address)', async () => {
    const fetchFn = routedFetch({
      '/capture': {
        payer: { email_address: 'buyer@paypal.com', name: { given_name: 'Pat', surname: 'Payer' } },
        purchase_units: [{
          shipping: { name: { full_name: 'Pat Payer' }, address: { address_line_1: '5 Main', admin_area_2: 'NYC', admin_area_1: 'NY', country_code: 'US', postal_code: '10001' } },
          payments: { captures: [{ id: 'cap_1', amount: { value: '19.99', currency_code: 'USD' }, create_time: '2026-06-04T00:00:00Z' }] },
        }],
      },
    }) as unknown as typeof fetch;
    const adapter = new PayPalProviderAdapter(cfg(fetchFn));
    const out = await adapter.capture('order_1', 'k1');
    expect(out.payer?.email).toBe('buyer@paypal.com');
    expect(out.payer?.name).toBe('Pat Payer');
    expect(out.payer?.address?.line1).toBe('5 Main');
    expect(out.payer?.address?.countryCode).toBe('US');
  });

  it('patchOrderAmount PATCHes the purchase-unit amount with the merged total', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/v1/oauth2/token')) return new Response(JSON.stringify({ access_token: 'tok_1' }), { status: 200 });
      calls.push({ url: u, init });
      if (init?.method === 'PATCH') return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ purchase_units: [{ reference_id: 'default' }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const adapter = new PayPalProviderAdapter(cfg(fetchFn));
    await adapter.patchOrderAmount('order_1', 'USD', 5950);
    const patch = calls.find((c) => c.init?.method === 'PATCH');
    expect(patch).toBeTruthy();
    const ops = JSON.parse(String(patch!.init!.body));
    expect(ops[0].op).toBe('replace');
    expect(ops[0].path).toContain('/amount');
    expect(ops[0].value.value).toBe('59.50');
    expect(ops[0].value.currency_code).toBe('USD');
  });

  it('refund posts to the capture refund endpoint and returns a refund ref', async () => {
    const fetchFn = routedFetch({ '/refund': { id: 're_1' } }) as unknown as typeof fetch;
    const adapter = new PayPalProviderAdapter(cfg(fetchFn));
    const out = await adapter.refund({ providerChargeId: 'cap_1', amountMinor: 500, currencyCode: 'USD', idempotencyKey: 'r1' });
    expect(out.providerRefundRef).toBe('re_1');
  });

  it('verifyWebhookSignature returns true only when the API reports SUCCESS', async () => {
    const ok = new PayPalProviderAdapter(cfg(routedFetch({ '/verify-webhook-signature': { verification_status: 'SUCCESS' } }) as unknown as typeof fetch));
    const bad = new PayPalProviderAdapter(cfg(routedFetch({ '/verify-webhook-signature': { verification_status: 'FAILURE' } }) as unknown as typeof fetch));
    const body = JSON.stringify({ id: 'evt_1' });
    const headers = { 'paypal-transmission-id': 't', 'paypal-transmission-sig': 's', 'paypal-transmission-time': 'now', 'paypal-cert-url': 'c', 'paypal-auth-algo': 'a' };
    expect(await ok.verifyWebhookSignature(body, headers, 'unused')).toBe(true);
    expect(await bad.verifyWebhookSignature(body, headers, 'unused')).toBe(false);
  });

  it('parseWebhook normalizes a PAYMENT.CAPTURE.COMPLETED event', () => {
    const adapter = new PayPalProviderAdapter(cfg(vi.fn() as unknown as typeof fetch));
    const body = JSON.stringify({ id: 'evt_1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'cap_1', amount: { value: '19.99', currency_code: 'USD' }, supplementary_data: { related_ids: { order_id: 'order_1' } } } });
    const parsed = adapter.parseWebhook(body);
    expect(parsed.type).toBe('PAYMENT_CAPTURED');
    expect(parsed.providerIntentId).toBe('order_1');
    expect(parsed.providerChargeId).toBe('cap_1');
    expect(parsed.capturedAmountMinor).toBe(1999);
    expect(parsed.currencyCode).toBe('USD');
  });
});

describe('createPaymentProvider factory', () => {
  it('builds a StripeProviderAdapter for STRIPE', () => {
    expect(createPaymentProvider('STRIPE', { secretKey: 'sk_test' })).toBeInstanceOf(StripeProviderAdapter);
  });
  it('builds a PayPalProviderAdapter for PAYPAL', () => {
    expect(createPaymentProvider('PAYPAL', { clientId: 'c', clientSecret: 's', webhookId: 'w' })).toBeInstanceOf(PayPalProviderAdapter);
  });
  it('throws on an unknown PSP slug', () => {
    expect(() => createPaymentProvider('VENMO' as never, {})).toThrow('Unknown PSP');
  });
});
