import { describe, it, expect, vi } from 'vitest';
import { StripeProviderAdapter } from '../stripe-provider.adapter';

async function stripeSignature(secret: string, timestamp: number, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${body}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `t=${timestamp},v1=${hex}`;
}

describe('StripeProviderAdapter', () => {
  it('createIntent (no vault) posts to /v1/payment_intents and returns a client_secret ClientHandle', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ id: 'pi_1', client_secret: 'pi_1_secret_x' }), { status: 200 }));
    const adapter = new StripeProviderAdapter({ apiKey: 'sk_test', fetchFn });
    const out = await adapter.createIntent({ amountMinor: 1999, currencyCode: 'USD', captureMethod: 'automatic', idempotencyKey: 'k1', saleRef: 'sale_1', vaultForReuse: false });
    expect(out.providerRef.providerIntentId).toBe('pi_1');
    expect(out.clientHandle.value).toBe('pi_1_secret_x');
    expect(out.vaultCustomerId).toBeUndefined();
    const call = fetchFn.mock.calls[0] as any[];
    expect(String(call[0])).toContain('/v1/payment_intents');
    expect((call[1] as any).headers['Idempotency-Key']).toBe('k1');
    expect((call[1] as any).body).not.toContain('setup_future_usage');
  });

  it('createIntent (vault default) creates a Customer + sets setup_future_usage=off_session, returns vaultCustomerId', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'cus_9' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'pi_2', client_secret: 'pi_2_secret' }), { status: 200 }));
    const adapter = new StripeProviderAdapter({ apiKey: 'sk_test', fetchFn });
    const out = await adapter.createIntent({ amountMinor: 2000, currencyCode: 'USD', captureMethod: 'automatic', idempotencyKey: 'k2', saleRef: 'sale_2' });
    expect(out.vaultCustomerId).toBe('cus_9');
    expect(out.providerRef.providerIntentId).toBe('pi_2');
    expect(String((fetchFn.mock.calls[0] as any[])[0])).toContain('/v1/customers');
    const piBody = (fetchFn.mock.calls[1] as any[])[1].body as string;
    expect(piBody).toContain('customer=cus_9');
    expect(piBody).toContain('setup_future_usage=off_session');
  });

  it('createIntent vaulting is best-effort: customer-create failure still creates the PI without vault', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'rate_limit' } }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'pi_3', client_secret: 'pi_3_secret' }), { status: 200 }));
    const adapter = new StripeProviderAdapter({ apiKey: 'sk_test', fetchFn });
    const out = await adapter.createIntent({ amountMinor: 500, currencyCode: 'USD', captureMethod: 'automatic', idempotencyKey: 'k3', saleRef: 'sale_3' });
    expect(out.providerRef.providerIntentId).toBe('pi_3');
    expect(out.vaultCustomerId).toBeUndefined();
    expect((fetchFn.mock.calls[1] as any[])[1].body).not.toContain('setup_future_usage');
  });

  it('chargeOffSession charges the saved method and maps a succeeded PI to CAPTURED', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      id: 'pi_up', status: 'succeeded', amount: 1500, amount_received: 1500, currency: 'usd',
      latest_charge: { id: 'ch_up', payment_method_details: { card: { brand: 'visa', last4: '4242' } } },
    }), { status: 200 }));
    const adapter = new StripeProviderAdapter({ apiKey: 'sk_test', fetchFn });
    const out = await adapter.chargeOffSession({ customerId: 'cus_9', paymentMethodId: 'pm_1', amountMinor: 1500, currencyCode: 'USD', idempotencyKey: 'upsell:sale_2:0', saleRef: 'sale_2' });
    expect(out.status).toBe('CAPTURED');
    expect(out.capture?.providerChargeId).toBe('ch_up');
    const body = (fetchFn.mock.calls[0] as any[])[1].body as string;
    expect(body).toContain('off_session=true');
    expect(body).toContain('confirm=true');
    expect(body).toContain('payment_method=pm_1');
    expect((fetchFn.mock.calls[0] as any[])[1].headers['Idempotency-Key']).toBe('upsell:sale_2:0');
  });

  it('chargeOffSession maps a declined charge to FAILED (no throw)', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'card_declined', message: 'declined' } }), { status: 402 }));
    const adapter = new StripeProviderAdapter({ apiKey: 'sk_test', fetchFn });
    const out = await adapter.chargeOffSession({ customerId: 'cus_9', paymentMethodId: 'pm_1', amountMinor: 1500, currencyCode: 'USD', idempotencyKey: 'upsell:sale_2:1', saleRef: 'sale_2' });
    expect(out.status).toBe('FAILED');
  });

  it('verifyWebhookSignature accepts a valid Stripe-Signature and rejects a tampered one', async () => {
    const secret = 'whsec_test';
    const body = JSON.stringify({ id: 'evt_1' });
    const ts = Math.floor(Date.now() / 1000);
    const adapter = new StripeProviderAdapter({ apiKey: 'sk_test', fetchFn: vi.fn() });
    const good = await stripeSignature(secret, ts, body);
    expect(await adapter.verifyWebhookSignature(body, { 'stripe-signature': good }, secret)).toBe(true);
    expect(await adapter.verifyWebhookSignature(body, { 'stripe-signature': good.replace('v1=', 'v1=00') }, secret)).toBe(false);
  });

  it('refund posts to /v1/refunds with the charge id and amount', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ id: 're_1' }), { status: 200 }));
    const adapter = new StripeProviderAdapter({ apiKey: 'sk_test', fetchFn });
    const out = await adapter.refund({ providerChargeId: 'ch_1', amountMinor: 500, currencyCode: 'USD', idempotencyKey: 'r1' });
    expect(out.providerRefundRef).toBe('re_1');
    expect(String((fetchFn.mock.calls[0] as any[])[0])).toContain('/v1/refunds');
  });

  it('parseWebhook normalizes a charge.captured event', () => {
    const adapter = new StripeProviderAdapter({ apiKey: 'sk_test', fetchFn: vi.fn() });
    const body = JSON.stringify({ id: 'evt_1', type: 'charge.captured', data: { object: { id: 'ch_1', payment_intent: 'pi_1', amount_captured: 1999, currency: 'usd', payment_method_details: { card: { brand: 'visa', last4: '4242' } } } } });
    const parsed = adapter.parseWebhook(body);
    expect(parsed.type).toBe('PAYMENT_CAPTURED');
    expect(parsed.providerIntentId).toBe('pi_1');
    expect(parsed.capturedAmountMinor).toBe(1999);
    expect(parsed.currencyCode).toBe('USD');
    expect(parsed.last4).toBe('4242');
  });
});
