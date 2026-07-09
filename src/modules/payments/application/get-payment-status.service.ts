import type { PaymentIntentRepositoryPort } from './ports/outbound';

export class GetPaymentStatusService {
  constructor(private readonly deps: { intentRepo: PaymentIntentRepositoryPort }) {}

  async getStatus(intentId: string) {
    const intent = await this.deps.intentRepo.findById(intentId);
    if (!intent) return null;
    return {
      status: intent.status,
      capturedAmountMinor: intent.captureResult?.capturedAmount.amountMinor,
      totalRefundedMinor: intent.totalRefunded().amountMinor,
    };
  }

  async getStatusBySaleRef(saleRef: string) {
    const intent = await this.deps.intentRepo.findBySaleRef(saleRef);
    return intent ? { status: intent.status } : null;
  }

  async updateCheckoutSnapshotBySaleRef(saleRef: string, snapshot: unknown): Promise<void> {
    await this.deps.intentRepo.updateCheckoutSnapshotBySaleRef(saleRef, snapshot);
  }

  async getCapturedBySaleRef(saleRef: string) {
    const intent = await this.deps.intentRepo.findBySaleRef(saleRef);
    if (!intent) return null;
    return {
      status: intent.status,
      capturedAmountMinor: intent.captureResult?.capturedAmount.amountMinor ?? null,
      currencyCode: intent.captureResult?.capturedAmount.currencyCode ?? intent.amount.currencyCode,
      checkoutSnapshot: intent.checkoutSnapshot ?? null,
    };
  }
}
