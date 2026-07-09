import { describe, it, expect, vi } from 'vitest';
import { ConfirmCardPaymentService } from '../confirm-card-payment.service';
import { PaymentIntent } from '../../domain/payment-intent';
import { SaleRef, CaptureMethod, CaptureResult } from '../../domain/value-objects';
import { Money } from '../../../shared-kernel/money';

function makeIntent(): PaymentIntent {
  const intent = PaymentIntent.create({ id: 'int_1', saleRef: SaleRef.of('sale_1'), provider: 'STRIPE', amount: Money.of(1999, 'USD'), captureMethod: CaptureMethod.AUTOMATIC });
  intent.bindProvider({ provider: 'STRIPE', providerIntentId: 'pi_1' } as never);
  return intent;
}

function captureProviderResult() {
  return { providerChargeId: 'ch_1', capturedAmountMinor: 1999, currencyCode: 'USD', capturedAt: new Date().toISOString(), cardBrand: 'visa', last4: '4242' };
}

function makeDeps(intent: PaymentIntent | null, confirmImpl: any) {
  const provider = {
    slug: 'STRIPE' as const,
    confirmIntent: vi.fn(confirmImpl),
    createIntent: vi.fn(), authorize: vi.fn(), capture: vi.fn(), cancel: vi.fn(), getIntent: vi.fn(), refund: vi.fn(),
    verifyWebhookSignature: vi.fn(), parseWebhook: vi.fn(),
  };
  const intentRepo = {
    findBySaleRef: vi.fn(async () => intent),
    save: vi.fn(),
    findById: vi.fn(), findByProviderRef: vi.fn(), findStaleProcessing: vi.fn(),
  };
  const events = { publish: vi.fn() };
  return { provider, intentRepo, events };
}

describe('ConfirmCardPaymentService', () => {
  it('succeeded → marks intent captured and publishes payment.captured once with the saleRef', async () => {
    const intent = makeIntent();
    const d = makeDeps(intent, async () => ({ status: 'CAPTURED', capture: captureProviderResult() }));
    const svc = new ConfirmCardPaymentService({ providerFor: async () => d.provider as never, intentRepo: d.intentRepo as never, events: d.events as never });

    const out = await svc.confirm({ saleRef: 'sale_1', paymentMethodId: 'pm_card_visa' });

    expect(out.status).toBe('succeeded');
    expect(intent.status).toBe('CAPTURED');
    expect(d.intentRepo.save).toHaveBeenCalledTimes(1);
    expect(d.events.publish).toHaveBeenCalledTimes(1);
    const emitted = d.events.publish.mock.calls[0][0];
    expect(emitted.type).toBe('payment.captured');
    expect(emitted.saleRef).toBe('sale_1');
  });

  it('requires_action → returns clientSecret and does NOT publish', async () => {
    const intent = makeIntent();
    const d = makeDeps(intent, async () => ({ status: 'REQUIRES_ACTION', clientSecret: 'pi_1_secret_x' }));
    const svc = new ConfirmCardPaymentService({ providerFor: async () => d.provider as never, intentRepo: d.intentRepo as never, events: d.events as never });

    const out = await svc.confirm({ saleRef: 'sale_1', paymentMethodId: 'pm_card_3ds' });

    expect(out).toEqual({ status: 'requires_action', clientSecret: 'pi_1_secret_x' });
    expect(intent.status).toBe('REQUIRES_PAYMENT');
    expect(d.events.publish).not.toHaveBeenCalled();
  });

  it('already-captured intent → returns succeeded without re-confirming or double-publishing', async () => {
    const intent = makeIntent();
    intent.markCaptured(CaptureResult.of({ providerChargeId: 'ch_1', capturedAmount: Money.of(1999, 'USD'), capturedAt: new Date() }));
    const d = makeDeps(intent, async () => ({ status: 'CAPTURED', capture: captureProviderResult() }));
    const svc = new ConfirmCardPaymentService({ providerFor: async () => d.provider as never, intentRepo: d.intentRepo as never, events: d.events as never });

    const out = await svc.confirm({ saleRef: 'sale_1', paymentMethodId: 'pm_card_visa' });

    expect(out.status).toBe('succeeded');
    expect(d.provider.confirmIntent).not.toHaveBeenCalled();
    expect(d.events.publish).not.toHaveBeenCalled();
  });

  it('failed → marks intent failed, returns error, does NOT publish', async () => {
    const intent = makeIntent();
    const d = makeDeps(intent, async () => ({ status: 'FAILED', error: { code: 'card_declined', message: 'Your card was declined.' } }));
    const svc = new ConfirmCardPaymentService({ providerFor: async () => d.provider as never, intentRepo: d.intentRepo as never, events: d.events as never });

    const out = await svc.confirm({ saleRef: 'sale_1', paymentMethodId: 'pm_card_chargeDeclined' });

    expect(out).toEqual({ status: 'failed', error: 'Your card was declined.', code: 'card_declined' });
    expect(intent.status).toBe('FAILED');
    expect(d.events.publish).not.toHaveBeenCalled();
  });
});
