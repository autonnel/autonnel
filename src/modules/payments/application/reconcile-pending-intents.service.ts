import type { PspSlug } from '../domain/value-objects';
import type { PaymentProviderPort, PaymentIntentRepositoryPort } from './ports/outbound';
import type { DomainEventPublisherPort } from '../../shared-kernel/event-envelope';
import { CompleteRedirectPaymentService } from './complete-redirect-payment.service';
import { createLogger } from '../../../lib/logger';

const logger = createLogger('ReconcilePendingIntentsService');

export interface ReconcileDeps {
  providerFor: (slug: PspSlug) => Promise<PaymentProviderPort>;
  intentRepo: PaymentIntentRepositoryPort;
  events: DomainEventPublisherPort;
  staleAfterMs: number;
  batchSize: number;
  // PROCESSING intents untouched this long are abandoned sessions and become CANCELED.
  expireAfterMs?: number;
}

export class ReconcilePendingIntentsService {
  private readonly completion: CompleteRedirectPaymentService;
  constructor(private readonly deps: ReconcileDeps) {
    this.completion = new CompleteRedirectPaymentService(deps);
  }

  async run(): Promise<{ reconciled: number; expired: number }> {
    const expired = this.deps.expireAfterMs
      ? await this.deps.intentRepo.cancelStaleProcessing(new Date(Date.now() - this.deps.expireAfterMs))
      : 0;
    const stale = await this.deps.intentRepo.findStaleProcessing(new Date(Date.now() - this.deps.staleAfterMs), this.deps.batchSize);
    let reconciled = 0;
    for (const intent of stale) {
      if (!intent.providerRef) continue;
      try {
        if ((await this.completion.finalizeBySaleRef(intent.saleRef.value)) === 'captured') reconciled++;
      } catch (error) {
        logger.warn('Reconcile of one intent failed', { saleRef: intent.saleRef.value, error });
      }
    }
    logger.info('Reconcile sweep complete', { scanned: stale.length, reconciled, expired });
    return { reconciled, expired };
  }
}
