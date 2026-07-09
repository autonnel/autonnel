import { describe, it, expect } from 'vitest';
import type {
  PaymentProviderPort,
} from '../outbound';
import type { PaymentIntentCommandPort } from '../inbound';
import { Money } from '../../../../shared-kernel/money';
import { SaleRef, CaptureMethod } from '../../../domain/value-objects';

describe('payments ports', () => {
  it('a fake PaymentProviderPort satisfies the outbound contract', () => {
    const fake: PaymentProviderPort = {
      slug: 'STRIPE',
      async createIntent() { return { providerRef: { provider: 'STRIPE', providerIntentId: 'pi_1' }, clientHandle: { provider: 'STRIPE', kind: 'client_secret', value: 'cs' } }; },
      async authorize() { return { providerChargeId: 'ch', status: 'AUTHORIZED' }; },
      async capture() { return { providerChargeId: 'ch', capturedAmountMinor: 1999, currencyCode: 'USD', capturedAt: new Date().toISOString() }; },
      async cancel() { return { status: 'CANCELED' }; },
      async getIntent() { return { status: 'CAPTURED' }; },
      async refund() { return { providerRefundRef: 're_1' }; },
      async verifyWebhookSignature() { return true; },
      parseWebhook() { return { provider: 'STRIPE', providerEventId: 'evt_1', type: 'PAYMENT_CAPTURED' }; },
    };
    expect(fake.slug).toBe('STRIPE');
  });

  it('PaymentIntentCommandPort.create signature accepts (SaleRef, Money, captureMethod)', () => {
    const fake: PaymentIntentCommandPort = {
      async create() { return { intentId: 'int_1', clientHandle: { provider: 'STRIPE', kind: 'client_secret', value: 'cs' } }; },
    };
    void (async () => fake.create({ saleRef: SaleRef.of('s'), amount: Money.of(1, 'USD'), captureMethod: CaptureMethod.AUTOMATIC }));
    expect(typeof fake.create).toBe('function');
  });
});
