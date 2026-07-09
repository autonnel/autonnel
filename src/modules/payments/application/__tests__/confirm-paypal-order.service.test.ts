import { describe, it, expect, vi } from 'vitest';
import { ConfirmPayPalOrderService } from '../confirm-paypal-order.service';
import { PaymentIntent } from '../../domain/payment-intent';
import { SaleRef, CaptureMethod } from '../../domain/value-objects';
import { Money } from '../../../shared-kernel/money';

function makeIntent(opts: { authorized?: boolean } = {}): PaymentIntent {
  const intent = PaymentIntent.create({ id: 'int_1', saleRef: SaleRef.of('sale_1'), provider: 'PAYPAL', amount: Money.of(1999, 'USD'), captureMethod: CaptureMethod.AUTOMATIC });
  intent.bindProvider({ provider: 'PAYPAL', providerIntentId: 'order_1' } as never);
  if (opts.authorized) { intent.markAuthorized(); intent.setCaptureDeferred(true); }
  return intent;
}

function makeDeps(intent: PaymentIntent | null) {
  const provider = {
    slug: 'PAYPAL' as const,
    capture: vi.fn(async () => ({ providerChargeId: 'cap_1', capturedAmountMinor: 5950, currencyCode: 'USD', capturedAt: new Date().toISOString() })),
    createIntent: vi.fn(), authorize: vi.fn(), confirmIntent: vi.fn(), cancel: vi.fn(), getIntent: vi.fn(), refund: vi.fn(),
    verifyWebhookSignature: vi.fn(), parseWebhook: vi.fn(),
  };
  const intentRepo = {
    findBySaleRef: vi.fn(async () => intent), save: vi.fn(),
    findById: vi.fn(), findByProviderRef: vi.fn(), findStaleProcessing: vi.fn(), findDeferredOlderThan: vi.fn(), updateCheckoutSnapshotBySaleRef: vi.fn(),
  };
  const events = { publish: vi.fn() };
  return { provider, intentRepo, events };
}

describe('ConfirmPayPalOrderService', () => {
  it('approve with defer marks AUTHORIZED + captureDeferred WITHOUT capturing or publishing', async () => {
    const intent = makeIntent();
    const d = makeDeps(intent);
    const svc = new ConfirmPayPalOrderService({ providerFor: async () => d.provider as never, intentRepo: d.intentRepo as never, events: d.events as never });

    const out = await svc.approve({ saleRef: 'sale_1', defer: true });

    expect(out).toEqual({ status: 'succeeded', deferred: true });
    expect(d.provider.capture).not.toHaveBeenCalled();
    expect(d.events.publish).not.toHaveBeenCalled();
    expect(intent.status).toBe('AUTHORIZED');
    expect(intent.captureDeferred).toBe(true);
    expect(d.intentRepo.save).toHaveBeenCalledOnce();
  });

  it('approve without defer captures and publishes payment.captured (unchanged path)', async () => {
    const intent = makeIntent();
    const d = makeDeps(intent);
    const svc = new ConfirmPayPalOrderService({ providerFor: async () => d.provider as never, intentRepo: d.intentRepo as never, events: d.events as never });

    const out = await svc.approve({ saleRef: 'sale_1' });

    expect(out.status).toBe('succeeded');
    expect(d.provider.capture).toHaveBeenCalledOnce();
    expect(d.events.publish).toHaveBeenCalledOnce();
    expect(intent.status).toBe('CAPTURED');
  });

  it('captureNow captures a deferred AUTHORIZED order, clears the flag, publishes', async () => {
    const intent = makeIntent({ authorized: true });
    const d = makeDeps(intent);
    const svc = new ConfirmPayPalOrderService({ providerFor: async () => d.provider as never, intentRepo: d.intentRepo as never, events: d.events as never });

    const out = await svc.captureNow({ saleRef: 'sale_1' });

    expect(out.status).toBe('succeeded');
    expect(d.provider.capture).toHaveBeenCalledOnce();
    expect(d.events.publish).toHaveBeenCalledOnce();
    expect(intent.status).toBe('CAPTURED');
    expect(intent.captureDeferred).toBe(false);
  });

  it('captureNow refuses when the intent is not AUTHORIZED', async () => {
    const intent = makeIntent(); // REQUIRES_PAYMENT
    const d = makeDeps(intent);
    const svc = new ConfirmPayPalOrderService({ providerFor: async () => d.provider as never, intentRepo: d.intentRepo as never, events: d.events as never });

    const out = await svc.captureNow({ saleRef: 'sale_1' });

    expect(out.status).toBe('failed');
    expect(d.provider.capture).not.toHaveBeenCalled();
  });
});
