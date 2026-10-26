import { CaptureResult, SaleRef, type PspSlug } from '../domain/value-objects';
import { Money } from '../../shared-kernel/money';
import { paymentCaptured } from '../domain/events';
import { PaymentIntentStatus } from '../domain/payment-intent-state-machine';
import type { PaymentIntent } from '../domain/payment-intent';
import type { ParsedWebhook, PaymentIntentRepositoryPort, PaymentProviderPort, ProviderCaptureResult } from './ports/outbound';
import type { DomainEventPublisherPort } from '../../shared-kernel/event-envelope';
import { createLogger } from '../../../lib/logger';

const logger = createLogger('CompleteRedirectPaymentService');

const IN_FLIGHT = new Set<string>([PaymentIntentStatus.REQUIRES_PAYMENT, PaymentIntentStatus.PROCESSING]);

export type RedirectOutcome = 'captured' | 'pending' | 'failed' | 'not_found';

export interface CompleteRedirectPaymentDeps {
  providerFor: (slug: PspSlug) => Promise<PaymentProviderPort>;
  intentRepo: PaymentIntentRepositoryPort;
  events: DomainEventPublisherPort;
  beforePublish?: (intent: PaymentIntent) => Promise<void>;
}

type ApplyResult = 'won' | 'lost' | 'not_capturable' | 'mismatch';

// Return redirect, provider notification and the reconcile cron all finish a hosted-page payment
// here. A failed signal never terminates the intent: the buyer may retry another card in the same
// hosted session, and FAILED is terminal.
export class CompleteRedirectPaymentService {
  constructor(private readonly deps: CompleteRedirectPaymentDeps) {}

  async finalizeBySaleRef(saleRef: string): Promise<RedirectOutcome> {
    const intent = await this.deps.intentRepo.findBySaleRef(saleRef);
    if (!intent?.providerRef) return 'not_found';
    if (intent.status === PaymentIntentStatus.CAPTURED) return 'captured';
    const provider = await this.deps.providerFor(intent.provider);
    const live = await provider.getIntent(intent.providerRef.providerIntentId, {
      amountMinor: intent.amount.amountMinor,
      currencyCode: intent.amount.currencyCode,
    });
    if (live.status === 'CAPTURED' && live.capture) {
      const result = await this.apply(intent, live.capture);
      if (result === 'not_capturable') return 'failed';
      return result === 'mismatch' ? 'pending' : 'captured';
    }
    return live.status === 'FAILED' ? 'failed' : 'pending';
  }

  async applyWebhook(slug: PspSlug, parsed: ParsedWebhook): Promise<'captured' | 'ignored'> {
    if (!parsed.providerIntentId) return 'ignored';
    const intent = await this.deps.intentRepo.findByProviderRef(slug, parsed.providerIntentId);
    if (!intent) return 'ignored';
    if (parsed.status === 'CAPTURED' && parsed.capture) {
      const result = await this.apply(intent, { ...parsed.capture, vaultRef: parsed.capture.vaultRef ?? parsed.vaultRef });
      if (result === 'mismatch' || result === 'not_capturable') return 'ignored';
      if (result === 'won' || IN_FLIGHT.has(intent.status) || intent.status === PaymentIntentStatus.CAPTURED) return 'captured';
      logger.warn('captured notification for non-capturable intent', { saleRef: intent.saleRef.value, status: intent.status });
      return 'ignored';
    }
    if (parsed.vaultRef) await this.deps.intentRepo.setVaultRef(intent.id, parsed.vaultRef);
    return 'ignored';
  }

  // Returns true only for the caller that won the capture.
  async applyCapture(intent: PaymentIntent, capture: ProviderCaptureResult): Promise<boolean> {
    return (await this.apply(intent, capture)) === 'won';
  }

  private async apply(intent: PaymentIntent, capture: ProviderCaptureResult): Promise<ApplyResult> {
    const saleRef = intent.saleRef.value;
    if (capture.vaultRef) await this.deps.intentRepo.setVaultRef(intent.id, capture.vaultRef);
    if (intent.status === PaymentIntentStatus.CAPTURED) return 'lost';
    if (
      capture.capturedAmountMinor !== intent.amount.amountMinor ||
      capture.currencyCode.toUpperCase() !== intent.amount.currencyCode.toUpperCase()
    ) {
      logger.error('captured amount does not match the intent; manual review required', {
        saleRef,
        expectedMinor: intent.amount.amountMinor,
        expectedCurrency: intent.amount.currencyCode,
        capturedMinor: capture.capturedAmountMinor,
        capturedCurrency: capture.currencyCode,
        providerChargeId: capture.providerChargeId,
      });
      return 'mismatch';
    }
    if (!(await this.deps.intentRepo.claimCapture(intent.id))) {
      const current = await this.deps.intentRepo.findBySaleRef(saleRef);
      if (current && current.status !== PaymentIntentStatus.CAPTURED) {
        logger.error('provider reported a captured payment for an intent that is not capturable; manual review required', {
          saleRef,
          status: current.status,
          providerChargeId: capture.providerChargeId,
        });
        return 'not_capturable';
      }
      return 'lost';
    }

    const captureResult = CaptureResult.of({
      providerChargeId: capture.providerChargeId,
      capturedAmount: Money.of(capture.capturedAmountMinor, capture.currencyCode.toUpperCase()),
      cardBrand: capture.cardBrand,
      last4: capture.last4,
      capturedAt: new Date(capture.capturedAt),
      payer: capture.payer,
    });
    try {
      intent.markCaptured(captureResult);
      if (capture.vaultRef) intent.setVaultRef(capture.vaultRef);
      await this.deps.intentRepo.save(intent);
    } catch (error) {
      try {
        await this.deps.intentRepo.releaseCapture(intent.id);
      } catch (releaseError) {
        logger.error('Failed to release the capture claim', { saleRef, error: releaseError });
      }
      throw error;
    }
    await this.deps.beforePublish?.(intent);
    await this.deps.events.publish(
      paymentCaptured({
        saleRef: SaleRef.of(intent.saleRef.value),
        captureResult,
        idempotencyKey: `capture:${intent.providerRef!.providerIntentId}`,
      }) as never,
    );
    logger.info('Redirect payment captured', { saleRef, provider: intent.provider });
    return 'won';
  }
}
