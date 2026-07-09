import { CaptureResult, SaleRef } from '../domain/value-objects';
import { Money } from '../../shared-kernel/money';
import { CaptureResultReconciler, CaptureSource } from '../domain/capture-result-reconciler';
import { paymentCaptured } from '../domain/events';
import { PaymentIntentStatus } from '../domain/payment-intent-state-machine';
import type { PaymentIntent } from '../domain/payment-intent';
import type {
  PaymentProviderPort, PaymentIntentRepositoryPort, ProviderCaptureResult,
} from './ports/outbound';
import type { PspSlug } from '../domain/value-objects';
import type { DomainEventPublisherPort } from '../../shared-kernel/event-envelope';
import { createLogger } from '../../../lib/logger';

const logger = createLogger('ConfirmCardPaymentService');

export interface ConfirmCardPaymentDeps {
  providerFor: (slug: PspSlug) => Promise<PaymentProviderPort>;
  intentRepo: PaymentIntentRepositoryPort;
  events: DomainEventPublisherPort;
}

export interface ConfirmInput {
  saleRef: string;
  paymentMethodId: string;
  idempotencyKey?: string;
  returnUrl?: string;
}

export interface FinalizeInput {
  saleRef: string;
  paymentIntentId?: string;
  idempotencyKey?: string;
}

export type ConfirmCardPaymentResult =
  | { status: 'succeeded' }
  | { status: 'requires_action'; clientSecret?: string }
  | { status: 'failed'; error?: string; code?: string };

export class ConfirmCardPaymentService {
  private readonly reconciler = new CaptureResultReconciler();
  constructor(private readonly deps: ConfirmCardPaymentDeps) {}

  async confirm(input: ConfirmInput): Promise<ConfirmCardPaymentResult> {
    const intent = await this.deps.intentRepo.findBySaleRef(input.saleRef);
    if (!intent?.providerRef) return { status: 'failed', error: 'intent_not_found', code: 'intent_not_found' };

    if (intent.status === PaymentIntentStatus.CAPTURED) return { status: 'succeeded' };

    const provider = await this.deps.providerFor(intent.provider);
    if (!provider.confirmIntent) return { status: 'failed', error: 'confirm_unsupported', code: 'confirm_unsupported' };

    const result = await provider.confirmIntent(intent.providerRef.providerIntentId, input.paymentMethodId, input.returnUrl);

    if (result.status === 'REQUIRES_ACTION') return { status: 'requires_action', clientSecret: result.clientSecret };
    if (result.status === 'CAPTURED' && result.capture) {
      // Persist the confirmed method so post-purchase upsells can charge it off-session.
      intent.setStripeVault({ paymentMethodId: input.paymentMethodId });
      await this.applyCapture(intent, result.capture, input.idempotencyKey);
      return { status: 'succeeded' };
    }
    // Authorize-only (manual capture): money is held, not collected — record as authorized and do NOT
    // publish payment.captured (no PAID order). A later capture flow collects the funds.
    if (result.status === 'AUTHORIZED') {
      intent.setStripeVault({ paymentMethodId: input.paymentMethodId });
      if (intent.status !== PaymentIntentStatus.AUTHORIZED) intent.markAuthorized();
      await this.deps.intentRepo.save(intent);
      logger.info('Card authorized (capture deferred)', { saleRef: input.saleRef, provider: intent.provider });
      return { status: 'requires_action' };
    }

    intent.markFailed();
    await this.deps.intentRepo.save(intent);
    logger.info('Card confirm failed', { saleRef: input.saleRef, code: result.error?.code });
    return { status: 'failed', error: result.error?.message ?? 'payment_failed', code: result.error?.code };
  }

  async finalize(input: FinalizeInput): Promise<ConfirmCardPaymentResult> {
    const intent = await this.deps.intentRepo.findBySaleRef(input.saleRef);
    if (!intent?.providerRef) return { status: 'failed', error: 'intent_not_found', code: 'intent_not_found' };

    if (intent.status === PaymentIntentStatus.CAPTURED) return { status: 'succeeded' };

    const provider = await this.deps.providerFor(intent.provider);
    const result = await provider.getIntent(intent.providerRef.providerIntentId);
    if (result.status === 'CAPTURED' && result.capture) {
      await this.applyCapture(intent, result.capture, input.idempotencyKey);
      return { status: 'succeeded' };
    }
    return { status: 'requires_action' };
  }

  private async applyCapture(intent: PaymentIntent, capture: ProviderCaptureResult, idempotencyKey?: string): Promise<void> {
    const captureResult = CaptureResult.of({
      providerChargeId: capture.providerChargeId,
      capturedAmount: Money.of(capture.capturedAmountMinor, capture.currencyCode),
      cardBrand: capture.cardBrand,
      last4: capture.last4,
      capturedAt: new Date(capture.capturedAt),
      payer: capture.payer,
    });
    const outcome = this.reconciler.reconcile({ existing: intent.captureResult, incoming: captureResult, source: CaptureSource.SYNC });
    if (!outcome.shouldApply) return; // already captured for this charge — never double-publish

    intent.markCaptured(captureResult);
    await this.deps.intentRepo.save(intent);
    await this.deps.events.publish(
      paymentCaptured({
        saleRef: SaleRef.of(intent.saleRef.value),
        captureResult,
        idempotencyKey: idempotencyKey ?? `confirm:${intent.providerRef!.providerIntentId}`,
      }) as never,
    );
    logger.info('Card payment captured', { saleRef: intent.saleRef.value, provider: intent.provider });
  }
}
