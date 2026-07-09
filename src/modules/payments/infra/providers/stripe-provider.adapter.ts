import type {
  PaymentProviderPort, ProviderCreateIntentInput, ProviderCreateIntentResult,
  ProviderCaptureResult, ProviderConfirmResult, ProviderRefundResult, ParsedWebhook,
  ProviderOffSessionChargeInput,
} from '../../application/ports/outbound';
import { constantTimeEquals } from '../../../shared-kernel/idempotency-key';

const STRIPE_API = 'https://api.stripe.com';
type FetchFn = typeof fetch;

const STRIPE_TYPE_MAP: Record<string, string> = {
  'charge.captured': 'PAYMENT_CAPTURED',
  'payment_intent.succeeded': 'PAYMENT_CAPTURED',
  'payment_intent.payment_failed': 'PAYMENT_FAILED',
  'payment_intent.canceled': 'PAYMENT_CANCELED',
  'charge.refunded': 'REFUND_SUCCEEDED',
  'charge.dispute.created': 'DISPUTE_CREATED',
};

function form(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) usp.set(k, String(v));
  return usp.toString();
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class StripeProviderAdapter implements PaymentProviderPort {
  readonly slug = 'STRIPE' as const;
  private readonly fetchFn: FetchFn;
  constructor(private readonly cfg: { apiKey: string; fetchFn?: FetchFn }) {
    // Wrap, never bare `fetch`: stored on `this` and called as `this.fetchFn(...)`, a bare
    // reference rebinds `this` to the adapter and Workers throws "Illegal invocation". The
    // arrow always calls global fetch unbound.
    this.fetchFn = cfg.fetchFn ?? ((input, init) => fetch(input, init));
  }

  private async post(path: string, body: string, idempotencyKey?: string): Promise<any> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.cfg.apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const res = await this.fetchFn(`${STRIPE_API}${path}`, { method: 'POST', headers, body });
    const json: any = await res.json();
    if (!res.ok) throw new Error(`Stripe error: ${json?.error?.code ?? res.status}`);
    return json;
  }

  async createIntent(input: ProviderCreateIntentInput): Promise<ProviderCreateIntentResult> {
    // Vault the card for later one-click upsell charges: a Customer + setup_future_usage=off_session
    // makes the confirmed payment method reusable off-session. Default ON (funnels may add upsells).
    const vault = input.vaultForReuse !== false;
    let customerId: string | undefined;
    if (vault) {
      try {
        const customer = await this.post('/v1/customers', form({ 'metadata[saleRef]': input.saleRef }), `customer:${input.saleRef}`);
        customerId = customer.id;
      } catch {
        customerId = undefined; // vaulting is best-effort; never block the base sale
      }
    }
    const json = await this.post('/v1/payment_intents', form({
      amount: input.amountMinor,
      currency: input.currencyCode.toLowerCase(),
      capture_method: input.captureMethod === 'manual' ? 'manual' : 'automatic',
      // Card-only, no redirect methods — lets server-side confirm work without a return_url.
      'automatic_payment_methods[enabled]': 'true',
      'automatic_payment_methods[allow_redirects]': 'never',
      'metadata[saleRef]': input.saleRef,
      customer: customerId,
      setup_future_usage: customerId ? 'off_session' : undefined,
    }), input.idempotencyKey);
    return {
      providerRef: { provider: 'STRIPE', providerIntentId: json.id },
      clientHandle: { provider: 'STRIPE', kind: 'client_secret', value: json.client_secret },
      vaultCustomerId: customerId,
    };
  }

  // One-click upsell: charge the saved card off-session. Returns CAPTURED on success, REQUIRES_ACTION
  // when the bank demands authentication (upsell skipped, buyer continues), FAILED on decline.
  async chargeOffSession(input: ProviderOffSessionChargeInput): Promise<ProviderConfirmResult> {
    try {
      const json = await this.post('/v1/payment_intents?expand[]=latest_charge', form({
        amount: input.amountMinor,
        currency: input.currencyCode.toLowerCase(),
        customer: input.customerId,
        payment_method: input.paymentMethodId,
        off_session: 'true',
        confirm: 'true',
        'metadata[saleRef]': input.saleRef,
        'metadata[kind]': 'upsell',
      }), input.idempotencyKey);
      const status: string = json.status;
      if (status === 'succeeded') {
        return { status: 'CAPTURED', capture: this.captureFromIntent(json) };
      }
      // requires_capture = authorize-only (manual capture): money held, NOT collected — never report CAPTURED.
      if (status === 'requires_capture') {
        return { status: 'AUTHORIZED' };
      }
      if (status === 'requires_action' || status === 'requires_source_action') {
        return { status: 'REQUIRES_ACTION', clientSecret: json.client_secret };
      }
      return { status: 'FAILED', error: { code: json.last_payment_error?.code, message: json.last_payment_error?.message } };
    } catch (err) {
      return { status: 'FAILED', error: { code: 'charge_failed', message: (err as Error).message } };
    }
  }

  async authorize(providerIntentId: string, idempotencyKey: string) {
    const json = await this.post(`/v1/payment_intents/${providerIntentId}/confirm`, '', idempotencyKey);
    return { providerChargeId: json.latest_charge ?? '', status: 'AUTHORIZED' };
  }

  async confirmIntent(providerIntentId: string, paymentMethodId: string, returnUrl?: string): Promise<ProviderConfirmResult> {
    const json = await this.post(
      `/v1/payment_intents/${providerIntentId}/confirm?expand[]=latest_charge`,
      form({ payment_method: paymentMethodId, return_url: returnUrl }),
    );
    const status: string = json.status;
    if (status === 'requires_action' || status === 'requires_source_action') {
      return { status: 'REQUIRES_ACTION', clientSecret: json.client_secret };
    }
    if (status === 'succeeded') {
      return { status: 'CAPTURED', capture: this.captureFromIntent(json) };
    }
    // requires_capture = authorize-only (manual capture): money held, NOT collected — never report CAPTURED.
    if (status === 'requires_capture') {
      return { status: 'AUTHORIZED' };
    }
    return { status: 'FAILED', error: { code: json.last_payment_error?.code, message: json.last_payment_error?.message } };
  }

  private captureFromIntent(json: any): ProviderCaptureResult {
    const charge = typeof json.latest_charge === 'object' ? json.latest_charge : (json.charges?.data?.[0] ?? {});
    const card = charge.payment_method_details?.card ?? {};
    return {
      providerChargeId: charge.id ?? json.latest_charge,
      capturedAmountMinor: json.amount_received ?? json.amount,
      currencyCode: String(json.currency).toUpperCase(),
      capturedAt: new Date().toISOString(),
      cardBrand: card.brand,
      last4: card.last4,
    };
  }

  async capture(providerIntentId: string, idempotencyKey: string): Promise<ProviderCaptureResult> {
    const json = await this.post(`/v1/payment_intents/${providerIntentId}/capture`, '', idempotencyKey);
    const charge = json.charges?.data?.[0] ?? {};
    return { providerChargeId: charge.id ?? json.latest_charge, capturedAmountMinor: json.amount_received ?? json.amount, currencyCode: String(json.currency).toUpperCase(), capturedAt: new Date().toISOString(), cardBrand: charge.payment_method_details?.card?.brand, last4: charge.payment_method_details?.card?.last4 };
  }

  async cancel(providerIntentId: string, idempotencyKey: string) {
    await this.post(`/v1/payment_intents/${providerIntentId}/cancel`, '', idempotencyKey);
    return { status: 'CANCELED' };
  }

  async getIntent(providerIntentId: string) {
    const res = await this.fetchFn(`${STRIPE_API}/v1/payment_intents/${providerIntentId}`, { headers: { Authorization: `Bearer ${this.cfg.apiKey}` } });
    const json: any = await res.json();
    if (json.status === 'succeeded') {
      const charge = json.charges?.data?.[0] ?? {};
      return { status: 'CAPTURED', capture: { providerChargeId: charge.id ?? json.latest_charge, capturedAmountMinor: json.amount_received ?? json.amount, currencyCode: String(json.currency).toUpperCase(), capturedAt: new Date().toISOString() } };
    }
    return { status: json.status };
  }

  async refund(input: { providerChargeId: string; amountMinor: number; currencyCode: string; idempotencyKey: string }): Promise<ProviderRefundResult> {
    const json = await this.post('/v1/refunds', form({ charge: input.providerChargeId, amount: input.amountMinor }), input.idempotencyKey);
    return { providerRefundRef: json.id };
  }

  async verifyWebhookSignature(rawBody: string, headers: Record<string, string>, signingSecret: string): Promise<boolean> {
    const header = headers['stripe-signature'] ?? headers['Stripe-Signature'];
    if (!header) return false;
    const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
    const ts = parts['t']; const v1 = parts['v1'];
    if (!ts || !v1) return false;
    const expected = await hmacHex(signingSecret, `${ts}.${rawBody}`);
    return constantTimeEquals(expected, v1);
  }

  parseWebhook(rawBody: string): ParsedWebhook {
    const evt = JSON.parse(rawBody);
    const obj = evt.data?.object ?? {};
    const card = obj.payment_method_details?.card ?? obj.card ?? {};
    return {
      provider: 'STRIPE',
      providerEventId: evt.id,
      type: STRIPE_TYPE_MAP[evt.type] ?? 'UNKNOWN',
      providerIntentId: obj.payment_intent ?? (evt.type.startsWith('payment_intent') ? obj.id : undefined),
      providerChargeId: obj.id,
      capturedAmountMinor: obj.amount_captured ?? obj.amount_received,
      currencyCode: obj.currency ? String(obj.currency).toUpperCase() : undefined,
      cardBrand: card.brand,
      last4: card.last4,
      refundedAmountMinor: obj.amount_refunded,
    };
  }
}
