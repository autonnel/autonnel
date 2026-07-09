import type { PaymentProviderPort, ProviderCreateIntentInput, ProviderCreateIntentResult, ProviderCaptureResult, ProviderRefundResult, ParsedWebhook } from '../../application/ports/outbound';

type FetchFn = typeof fetch;
const PAYPAL_TYPE_MAP: Record<string, string> = {
  'PAYMENT.CAPTURE.COMPLETED': 'PAYMENT_CAPTURED',
  'PAYMENT.CAPTURE.DENIED': 'PAYMENT_FAILED',
  'PAYMENT.CAPTURE.REFUNDED': 'REFUND_SUCCEEDED',
  'CUSTOMER.DISPUTE.CREATED': 'DISPUTE_CREATED',
};

export class PayPalProviderAdapter implements PaymentProviderPort {
  readonly slug = 'PAYPAL' as const;
  private readonly fetchFn: FetchFn;
  constructor(private readonly cfg: { clientId: string; clientSecret: string; baseUrl: string; webhookId: string; fetchFn?: FetchFn }) {
    // Wrap, never bare `fetch`: stored on `this` and called as `this.fetchFn(...)`, a bare
    // reference rebinds `this` to the adapter and Workers throws "Illegal invocation". The
    // arrow always calls global fetch unbound.
    this.fetchFn = cfg.fetchFn ?? ((input, init) => fetch(input, init));
  }

  private async accessToken(): Promise<string> {
    const basic = btoa(`${this.cfg.clientId}:${this.cfg.clientSecret}`);
    const res = await this.fetchFn(`${this.cfg.baseUrl}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
    const json: any = await res.json();
    if (!res.ok || !json.access_token) {
      throw new Error(`PayPal auth failed (${res.status}) at ${this.cfg.baseUrl}: ${json.error ?? ''} ${json.error_description ?? ''}`.trim());
    }
    return json.access_token;
  }

  async createIntent(input: ProviderCreateIntentInput): Promise<ProviderCreateIntentResult> {
    const token = await this.accessToken();
    const res = await this.fetchFn(`${this.cfg.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': input.idempotencyKey },
      // IMMEDIATE_PAYMENT_REQUIRED rejects eCheck and other delayed funding; default UNRESTRICTED would accept them.
      body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ custom_id: input.saleRef, amount: { currency_code: input.currencyCode, value: (input.amountMinor / 100).toFixed(2) } }], payment_source: { paypal: { experience_context: { payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED' } } } }),
    });
    const json: any = await res.json();
    if (!res.ok || !json.id) {
      throw new Error(`PayPal create order failed (${res.status}): ${json.name ?? ''} ${json.message ?? JSON.stringify(json.details ?? json)}`.trim());
    }
    const approval = (json.links ?? []).find((l: any) => l.rel === 'approve')?.href ?? '';
    return { providerRef: { provider: 'PAYPAL', providerIntentId: json.id }, clientHandle: { provider: 'PAYPAL', kind: 'approval_url', value: approval } };
  }

  async authorize() { return { providerChargeId: '', status: 'AUTHORIZED' }; }

  // Raise the total of an approved-but-uncaptured order so an accepted upsell is captured in the
  // same payment. Items aren't set on our orders, so an amount-only PATCH stays consistent.
  async patchOrderAmount(orderId: string, currencyCode: string, totalMinor: number): Promise<void> {
    const token = await this.accessToken();
    const getRes = await this.fetchFn(`${this.cfg.baseUrl}/v2/checkout/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
    const order: any = await getRes.json();
    if (!getRes.ok) throw new Error(`PayPal get order failed (${getRes.status}): ${order?.message ?? ''}`.trim());
    const refId = order.purchase_units?.[0]?.reference_id || 'default';
    const res = await this.fetchFn(`${this.cfg.baseUrl}/v2/checkout/orders/${orderId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { op: 'replace', path: `/purchase_units/@reference_id=='${refId}'/amount`, value: { currency_code: currencyCode, value: (totalMinor / 100).toFixed(2) } },
      ]),
    });
    if (!res.ok && res.status !== 204) {
      const json: any = await res.json().catch(() => ({}));
      throw new Error(`PayPal patch order failed (${res.status}): ${json?.message ?? JSON.stringify(json?.details ?? json)}`.trim());
    }
  }

  async capture(providerIntentId: string, idempotencyKey: string): Promise<ProviderCaptureResult> {
    const token = await this.accessToken();
    const res = await this.fetchFn(`${this.cfg.baseUrl}/v2/checkout/orders/${providerIntentId}/capture`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': idempotencyKey } });
    const json: any = await res.json();
    const cap = json.purchase_units?.[0]?.payments?.captures?.[0] ?? {};
    const amount = cap.amount ?? { value: '0', currency_code: 'USD' };
    const payerObj = json.payer ?? {};
    const ship = json.purchase_units?.[0]?.shipping;
    const addr = ship?.address ?? payerObj.address ?? {};
    const email = payerObj.email_address;
    const payer = email ? {
      email,
      name: ship?.name?.full_name || [payerObj.name?.given_name, payerObj.name?.surname].filter(Boolean).join(' ') || undefined,
      address: {
        line1: addr.address_line_1, line2: addr.address_line_2,
        city: addr.admin_area_2, region: addr.admin_area_1,
        countryCode: addr.country_code, postalCode: addr.postal_code,
      },
    } : undefined;
    return { providerChargeId: cap.id, capturedAmountMinor: Math.round(parseFloat(amount.value) * 100), currencyCode: amount.currency_code, capturedAt: cap.create_time ?? new Date().toISOString(), payer };
  }

  async cancel() { return { status: 'CANCELED' }; }

  async getIntent(providerIntentId: string) {
    const token = await this.accessToken();
    const res = await this.fetchFn(`${this.cfg.baseUrl}/v2/checkout/orders/${providerIntentId}`, { headers: { Authorization: `Bearer ${token}` } });
    const json: any = await res.json();
    if (json.status === 'COMPLETED') {
      const cap = json.purchase_units?.[0]?.payments?.captures?.[0] ?? {};
      const amount = cap.amount ?? { value: '0', currency_code: 'USD' };
      return { status: 'CAPTURED', capture: { providerChargeId: cap.id, capturedAmountMinor: Math.round(parseFloat(amount.value) * 100), currencyCode: amount.currency_code, capturedAt: cap.create_time ?? new Date().toISOString() } };
    }
    return { status: json.status };
  }

  async refund(input: { providerChargeId: string; amountMinor: number; currencyCode: string; idempotencyKey: string }): Promise<ProviderRefundResult> {
    const token = await this.accessToken();
    const res = await this.fetchFn(`${this.cfg.baseUrl}/v2/payments/captures/${input.providerChargeId}/refund`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': input.idempotencyKey }, body: JSON.stringify({ amount: { value: (input.amountMinor / 100).toFixed(2), currency_code: input.currencyCode } }) });
    const json: any = await res.json();
    return { providerRefundRef: json.id };
  }

  // PayPal verifies webhooks via an API call (no local HMAC); call verify-webhook-signature.
  async verifyWebhookSignature(rawBody: string, headers: Record<string, string>, _signingSecret: string): Promise<boolean> {
    const token = await this.accessToken();
    const res = await this.fetchFn(`${this.cfg.baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: this.cfg.webhookId,
        webhook_event: JSON.parse(rawBody),
      }),
    });
    const json: any = await res.json();
    return json.verification_status === 'SUCCESS';
  }

  parseWebhook(rawBody: string): ParsedWebhook {
    const evt = JSON.parse(rawBody);
    const resource = evt.resource ?? {};
    const amount = resource.amount ?? {};
    return {
      provider: 'PAYPAL',
      providerEventId: evt.id,
      type: PAYPAL_TYPE_MAP[evt.event_type] ?? 'UNKNOWN',
      providerIntentId: resource.supplementary_data?.related_ids?.order_id,
      providerChargeId: resource.id,
      capturedAmountMinor: amount.value ? Math.round(parseFloat(amount.value) * 100) : undefined,
      currencyCode: amount.currency_code,
    };
  }
}
