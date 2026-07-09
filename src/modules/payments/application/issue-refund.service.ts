import { Money } from '../../shared-kernel/money';
import { RefundKind, SaleRef, type PspSlug } from '../domain/value-objects';
import { RefundAmountCalculator } from '../domain/refund-amount-calculator';
import { refundIssued } from '../domain/events';
import { IntentNotCapturedError } from '../domain/errors';
import type { PaymentProviderPort, PaymentIntentRepositoryPort, TransactionRepositoryPort } from './ports/outbound';
import type { DomainEventPublisherPort } from '../../shared-kernel/event-envelope';
import { createLogger } from '../../../lib/logger';

const logger = createLogger('IssueRefundService');

export interface IssueRefundDeps {
  providerFor: (slug: PspSlug) => Promise<PaymentProviderPort>;
  intentRepo: PaymentIntentRepositoryPort;
  txRepo: TransactionRepositoryPort;
  events: DomainEventPublisherPort;
  newRefundId: () => string;
}

export interface IssueRefundInput {
  intentId: string;
  kind: RefundKind;
  fixedAmount?: Money;
  percentage?: number;
  reason?: string;
  idempotencyKey: string;
  // Which underlying charge to refund. Omit to refund the base charge (single-charge intents).
  chargeRef?: string;
}

export class IssueRefundService {
  private readonly calc = new RefundAmountCalculator();
  constructor(private readonly deps: IssueRefundDeps) {}

  async refund(input: IssueRefundInput): Promise<{ refundTransactionId: string; refundedAmountMinor: number }> {
    const intent = await this.deps.intentRepo.findById(input.intentId);
    if (!intent) throw new Error(`PaymentIntent not found: ${input.intentId}`);
    if (intent.status !== 'CAPTURED' || !intent.captureResult) throw new IntentNotCapturedError(intent.id);

    // A merged-upsell intent has N charges (base + each upsell). A refund targets ONE charge and is
    // capped at THAT charge's amount, because the PSP refunds per charge. Resolve the target: an
    // explicit chargeRef, else the base. Fall back to a synthetic single charge for legacy intents
    // whose charges were never recorded as Transaction rows.
    const baseRef = intent.captureResult.providerChargeId;
    const targetRef = input.chargeRef ?? baseRef;
    const charges = await this.deps.txRepo.listCharges(intent.id);
    const targetCharge =
      charges.find((c) => c.chargeRef === targetRef) ??
      (charges.length === 0 && targetRef === baseRef
        ? { chargeRef: baseRef, amountMinor: intent.captureResult.capturedAmount.amountMinor, currencyCode: intent.captureResult.capturedAmount.currencyCode }
        : undefined);
    if (!targetCharge) throw new Error(`Charge not found for refund: ${targetRef}`);
    const captured = Money.of(targetCharge.amountMinor, targetCharge.currencyCode);

    // Reserve under a per-intent lock: the per-charge balance check and the reservation write are
    // atomic, so two concurrent refunds with distinct idempotency keys cannot both pass against the
    // same prior sum for that charge.
    const reservation = await this.deps.txRepo.reserveRefund({
      parentTransactionId: intent.id,
      chargeRef: targetRef,
      idempotencyKey: input.idempotencyKey,
      decide: (priorRefundsMinor) => {
        const priorRefunds = Money.of(priorRefundsMinor, captured.currencyCode);
        const amount = this.calc.resolve({ kind: input.kind, captured, priorRefunds, fixedAmount: input.fixedAmount, percentage: input.percentage });
        return { id: this.deps.newRefundId(), kind: input.kind, amount, reason: input.reason };
      },
    });

    const refund = reservation.refund;
    if (reservation.status === 'duplicate') {
      return { refundTransactionId: refund.id, refundedAmountMinor: refund.amount.amountMinor };
    }

    const provider = await this.deps.providerFor(intent.provider);
    let refundRes;
    try {
      refundRes = await provider.refund({
        providerChargeId: targetRef,
        amountMinor: refund.amount.amountMinor,
        currencyCode: refund.amount.currencyCode,
        idempotencyKey: input.idempotencyKey,
      });
    } catch (err) {
      await this.deps.txRepo.failRefund(refund.id);
      throw err;
    }

    await this.deps.txRepo.settleRefund(refund.id, refundRes.providerRefundRef);

    intent.recordRefund({ transactionId: refund.id, amount: refund.amount });
    await this.deps.intentRepo.save(intent);

    await this.deps.events.publish(
      refundIssued({ saleRef: SaleRef.of(intent.saleRef.value), refunded: refund.amount, parentTransactionId: intent.id, refundTransactionId: refund.id, idempotencyKey: input.idempotencyKey }) as any,
    );

    logger.info('Refund issued', { intentId: intent.id, refundTransactionId: refund.id, amountMinor: refund.amount.amountMinor });
    return { refundTransactionId: refund.id, refundedAmountMinor: refund.amount.amountMinor };
  }
}
