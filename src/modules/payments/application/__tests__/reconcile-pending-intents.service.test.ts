import { describe, it, expect, vi } from 'vitest';
import { ReconcilePendingIntentsService } from '../reconcile-pending-intents.service';
import { GetPaymentStatusService } from '../get-payment-status.service';
import { PaymentIntent } from '../../domain/payment-intent';
import { SaleRef, CaptureMethod, CaptureResult } from '../../domain/value-objects';
import { Money } from '../../../shared-kernel/money';

function processingIntent() {
  const i = PaymentIntent.create({ id: 'int_1', saleRef: SaleRef.of('sale_1'), provider: 'STRIPE', amount: Money.of(1999, 'USD'), captureMethod: CaptureMethod.AUTOMATIC });
  i.bindProvider({ provider: 'STRIPE', providerIntentId: 'pi_1' } as any);
  i.markProcessing();
  return i;
}

describe('ReconcilePendingIntentsService', () => {
  it('polls the provider for stale PROCESSING intents and applies a captured result as SYNC source, emitting PaymentCaptured', async () => {
    const intent = processingIntent();
    const provider = {
      slug: 'STRIPE' as const,
      getIntent: vi.fn(async () => ({ status: 'CAPTURED', capture: { providerChargeId: 'ch_1', capturedAmountMinor: 1999, currencyCode: 'USD', capturedAt: new Date().toISOString() } })),
      createIntent: vi.fn(), authorize: vi.fn(), capture: vi.fn(), cancel: vi.fn(), refund: vi.fn(), verifyWebhookSignature: vi.fn(), parseWebhook: vi.fn(),
    };
    const intentRepo = { findStaleProcessing: vi.fn(async () => [intent]), save: vi.fn(), findById: vi.fn(), findByProviderRef: vi.fn(), findBySaleRef: vi.fn() };
    const events = { publish: vi.fn() };
    const svc = new ReconcilePendingIntentsService({ providerFor: async () => provider as any, intentRepo: intentRepo as any, events: events as any, staleAfterMs: 600000, batchSize: 50 });
    const out = await svc.run();
    expect(out.reconciled).toBe(1);
    expect(intent.status).toBe('CAPTURED');
    expect(events.publish.mock.calls[0][0].type).toBe('payment.captured');
  });
});

describe('GetPaymentStatusService', () => {
  it('returns status + capturedAmount + totalRefunded for a known intent', async () => {
    const i = processingIntent();
    i.markCaptured(CaptureResult.of({ providerChargeId: 'ch_1', capturedAmount: Money.of(1999, 'USD'), capturedAt: new Date() }));
    const repo = { findById: vi.fn(async () => i), findBySaleRef: vi.fn(), findByProviderRef: vi.fn(), save: vi.fn(), findStaleProcessing: vi.fn() };
    const svc = new GetPaymentStatusService({ intentRepo: repo as any });
    const out = await svc.getStatus('int_1');
    expect(out?.status).toBe('CAPTURED');
    expect(out?.capturedAmountMinor).toBe(1999);
    expect(out?.totalRefundedMinor).toBe(0);
  });
});
