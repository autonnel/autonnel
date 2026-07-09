import { CaptureResult, SaleRef } from '../domain/value-objects';
import { Money } from '../../shared-kernel/money';
import { CaptureResultReconciler, CaptureSource } from '../domain/capture-result-reconciler';
import { paymentCaptured } from '../domain/events';
import { PaymentIntentStatus } from '../domain/payment-intent-state-machine';
import type { PaymentProviderPort, PaymentIntentRepositoryPort } from './ports/outbound';
import type { PspSlug } from '../domain/value-objects';
import type { DomainEventPublisherPort } from '../../shared-kernel/event-envelope';
import { createLogger } from '../../../lib/logger';

const logger = createLogger('ConfirmPayPalOrderService');

export interface ConfirmPayPalOrderDeps {
  providerFor: (slug: PspSlug) => Promise<PaymentProviderPort>;
  intentRepo: PaymentIntentRepositoryPort;
  events: DomainEventPublisherPort;
}

export interface ApproveInput {
  saleRef: string;
  payerId?: string;
  idempotencyKey?: string;
  // Merged-upsell funnels: hold capture (mark AUTHORIZED) so accepted upsells can be PATCHed into
  // the same order before a single final capture. The order is NOT created until that capture.
  defer?: boolean;
}

export type ConfirmPayPalOrderResult =
  | { status: 'succeeded'; deferred?: boolean }
  | { status: 'failed'; error?: string };

export class ConfirmPayPalOrderService {
  private readonly reconciler = new CaptureResultReconciler();
  constructor(private readonly deps: ConfirmPayPalOrderDeps) {}

  async approve(input: ApproveInput): Promise<ConfirmPayPalOrderResult> {
    const intent = await this.deps.intentRepo.findBySaleRef(input.saleRef);
    if (!intent?.providerRef) return { status: 'failed', error: 'intent_not_found' };
    if (intent.status === PaymentIntentStatus.CAPTURED) return { status: 'succeeded' };

    if (input.defer) {
      if (intent.status !== PaymentIntentStatus.AUTHORIZED) intent.markAuthorized();
      intent.setCaptureDeferred(true);
      await this.deps.intentRepo.save(intent);
      logger.info('PayPal order approved, capture deferred for upsells', { saleRef: input.saleRef });
      return { status: 'succeeded', deferred: true };
    }

    return this.captureAndPublish(intent, input.idempotencyKey);
  }

  // Final capture of a deferred (AUTHORIZED) order — from the last upsell step or the safety-net cron.
  async captureNow(input: { saleRef: string; idempotencyKey?: string }): Promise<ConfirmPayPalOrderResult> {
    const intent = await this.deps.intentRepo.findBySaleRef(input.saleRef);
    if (!intent?.providerRef) return { status: 'failed', error: 'intent_not_found' };
    if (intent.status === PaymentIntentStatus.CAPTURED) return { status: 'succeeded' };
    if (intent.status !== PaymentIntentStatus.AUTHORIZED) return { status: 'failed', error: 'not_authorized' };
    return this.captureAndPublish(intent, input.idempotencyKey);
  }

  private async captureAndPublish(intent: import('../domain/payment-intent').PaymentIntent, idempotencyKey?: string): Promise<ConfirmPayPalOrderResult> {
    const provider = await this.deps.providerFor(intent.provider);
    const idemKey = idempotencyKey ?? `capture:${intent.providerRef!.providerIntentId}`;
    const capture = await provider.capture(intent.providerRef!.providerIntentId, idemKey);

    const captureResult = CaptureResult.of({
      providerChargeId: capture.providerChargeId,
      capturedAmount: Money.of(capture.capturedAmountMinor, capture.currencyCode),
      cardBrand: capture.cardBrand,
      last4: capture.last4,
      capturedAt: new Date(capture.capturedAt),
      payer: capture.payer,
    });
    const outcome = this.reconciler.reconcile({ existing: intent.captureResult, incoming: captureResult, source: CaptureSource.SYNC });
    if (!outcome.shouldApply) return { status: 'succeeded' };

    intent.setCaptureDeferred(false);
    intent.markCaptured(captureResult);
    await this.deps.intentRepo.save(intent);
    await this.deps.events.publish(
      paymentCaptured({ saleRef: SaleRef.of(intent.saleRef.value), captureResult, idempotencyKey: idemKey }) as never,
    );
    logger.info('PayPal order captured', { saleRef: intent.saleRef.value });
    return { status: 'succeeded' };
  }
}
