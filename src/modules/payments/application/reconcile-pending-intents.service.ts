import { CaptureResult, SaleRef, type PspSlug } from '../domain/value-objects';
import { Money } from '../../shared-kernel/money';
import { CaptureResultReconciler, CaptureSource } from '../domain/capture-result-reconciler';
import { paymentCaptured } from '../domain/events';
import type { PaymentProviderPort, PaymentIntentRepositoryPort } from './ports/outbound';
import type { DomainEventPublisherPort } from '../../shared-kernel/event-envelope';
import { createLogger } from '../../../lib/logger';

const logger = createLogger('ReconcilePendingIntentsService');

export interface ReconcileDeps {
  providerFor: (slug: PspSlug) => Promise<PaymentProviderPort>;
  intentRepo: PaymentIntentRepositoryPort;
  events: DomainEventPublisherPort;
  staleAfterMs: number;
  batchSize: number;
}

export class ReconcilePendingIntentsService {
  private readonly reconciler = new CaptureResultReconciler();
  constructor(private readonly deps: ReconcileDeps) {}

  async run(): Promise<{ reconciled: number }> {
    const cutoff = new Date(Date.now() - this.deps.staleAfterMs);
    const stale = await this.deps.intentRepo.findStaleProcessing(cutoff, this.deps.batchSize);
    let reconciled = 0;

    for (const intent of stale) {
      if (!intent.providerRef) continue;
      const provider = await this.deps.providerFor(intent.provider);
      const live = await provider.getIntent(intent.providerRef.providerIntentId);
      if (live.status === 'CAPTURED' && live.capture) {
        const captureResult = CaptureResult.of({
          providerChargeId: live.capture.providerChargeId,
          capturedAmount: Money.of(live.capture.capturedAmountMinor, live.capture.currencyCode),
          capturedAt: new Date(live.capture.capturedAt),
        });
        const outcome = this.reconciler.reconcile({ existing: intent.captureResult, incoming: captureResult, source: CaptureSource.SYNC });
        if (outcome.shouldApply) {
          intent.markCaptured(captureResult);
          await this.deps.intentRepo.save(intent);
          await this.deps.events.publish(
            paymentCaptured({ saleRef: SaleRef.of(intent.saleRef.value), captureResult, idempotencyKey: `reconcile:${intent.id}` }) as any,
          );
          reconciled++;
        }
      }
    }

    logger.info('Reconcile sweep complete', { scanned: stale.length, reconciled });
    return { reconciled };
  }
}
