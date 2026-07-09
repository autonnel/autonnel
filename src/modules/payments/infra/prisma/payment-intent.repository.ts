import { PaymentIntent } from '../../domain/payment-intent';
import { CaptureResult, ProviderRef, SaleRef } from '../../domain/value-objects';
import type { PspSlug } from '../../domain/value-objects';
import { Money } from '../../../shared-kernel/money';
import { getCurrentTenantId } from '../../../../lib/tenant/context';
import type { PaymentIntentRepositoryPort } from '../../application/ports/outbound';
import type { PaymentIntentStatus } from '../../domain/payment-intent-state-machine';

export class PrismaPaymentIntentRepository implements PaymentIntentRepositoryPort {
  constructor(private readonly prisma: any) {}

  async save(intent: PaymentIntent): Promise<void> {
    const cr = intent.captureResult;
    const data = {
      id: intent.id,
      saleRef: intent.saleRef.value,
      provider: intent.provider,
      amountMinor: intent.amount.amountMinor,
      currencyCode: intent.amount.currencyCode,
      captureMethod: intent.captureMethod,
      status: intent.status,
      providerIntentId: intent.providerRef?.providerIntentId ?? null,
      providerChargeId: cr?.providerChargeId ?? null,
      capturedMinor: cr?.capturedAmount.amountMinor ?? null,
      feeMinor: cr?.fee?.amountMinor ?? null,
      cardBrand: cr?.cardBrand ?? null,
      last4: cr?.last4 ?? null,
      capturedAt: cr?.capturedAt ?? null,
      checkoutSnapshot: (intent.checkoutSnapshot ?? null) as never,
      stripeCustomerId: intent.stripeCustomerId ?? null,
      stripePaymentMethodId: intent.stripePaymentMethodId ?? null,
      captureDeferred: intent.captureDeferred,
      handoffDeferred: intent.handoffDeferred,
    };
    // tenantId auto-injected by the Prisma extension on create/update.
    await this.prisma.paymentIntent.upsert({ where: { id: intent.id }, create: data as never, update: data });
    if (intent.status === 'CAPTURED' && cr) await this.recordCharge(intent, cr);
  }

  // A captured intent must surface as a CHARGE row in /transactions. Recorded here because every
  // capture path (confirm-card / confirm-paypal / webhook / reconcile) funnels through save(), and
  // the chokepoint is synchronous (unlike best-effort event delivery, which swallows failures).
  // Idempotent on the (tenantId, idempotencyKey) unique: repeated saves of a captured intent (e.g.
  // when a later refund is recorded) collide on `charge:<intentId>` and are ignored.
  private async recordCharge(intent: PaymentIntent, cr: CaptureResult): Promise<void> {
    try {
      await this.prisma.transaction.create({
        data: {
          type: 'CHARGE',
          status: 'SUCCEEDED',
          amountMinor: cr.capturedAmount.amountMinor,
          currencyCode: cr.capturedAmount.currencyCode,
          provider: intent.provider,
          providerRefundRef: cr.providerChargeId,
          parentTransactionId: intent.id,
          chargeRef: cr.providerChargeId,
          idempotencyKey: `charge:${intent.id}`,
        } as never,
      });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
    }
  }

  async findById(id: string): Promise<PaymentIntent | null> {
    return this.map(await this.prisma.paymentIntent.findUnique({ where: { id } }));
  }

  async findByProviderRef(provider: PspSlug, providerIntentId: string): Promise<PaymentIntent | null> {
    return this.map(await this.prisma.paymentIntent.findUnique({ where: { provider_providerIntentId: { provider, providerIntentId } } }));
  }

  async findBySaleRef(saleRef: string): Promise<PaymentIntent | null> {
    return this.map(await this.prisma.paymentIntent.findUnique({ where: { tenantId_saleRef: { tenantId: getCurrentTenantId(), saleRef } } }));
  }

  async updateCheckoutSnapshotBySaleRef(saleRef: string, snapshot: unknown): Promise<void> {
    await this.prisma.paymentIntent.update({
      where: { tenantId_saleRef: { tenantId: getCurrentTenantId(), saleRef } },
      data: { checkoutSnapshot: (snapshot ?? null) as never },
    });
  }

  async findStaleProcessing(olderThan: Date, limit: number): Promise<PaymentIntent[]> {
    const rows = await this.prisma.paymentIntent.findMany({ where: { status: 'PROCESSING', updatedAt: { lt: olderThan } }, take: limit });
    return rows.map((r: any) => this.map(r)!).filter(Boolean);
  }

  async findDeferredOlderThan(olderThan: Date, limit: number): Promise<PaymentIntent[]> {
    const rows = await this.prisma.paymentIntent.findMany({ where: { status: 'AUTHORIZED', captureDeferred: true, updatedAt: { lt: olderThan } }, take: limit });
    return rows.map((r: any) => this.map(r)!).filter(Boolean);
  }

  // Abandoned Stripe merged-upsell sessions: base already CAPTURED, but the single ecommerce push is
  // still held (handoffDeferred). Push the merged order so fulfillment isn't lost.
  async findHandoffDeferredOlderThan(olderThan: Date, limit: number): Promise<PaymentIntent[]> {
    const rows = await this.prisma.paymentIntent.findMany({ where: { status: 'CAPTURED', handoffDeferred: true, updatedAt: { lt: olderThan } }, take: limit });
    return rows.map((r: any) => this.map(r)!).filter(Boolean);
  }

  private map(row: any): PaymentIntent | null {
    if (!row) return null;
    const captureResult = row.status === 'CAPTURED' && row.providerChargeId
      ? CaptureResult.of({ providerChargeId: row.providerChargeId, capturedAmount: Money.of(row.capturedMinor, row.currencyCode), fee: row.feeMinor != null ? Money.of(row.feeMinor, row.currencyCode) : undefined, cardBrand: row.cardBrand ?? undefined, last4: row.last4 ?? undefined, capturedAt: row.capturedAt })
      : undefined;
    return PaymentIntent.rehydrate({
      id: row.id,
      saleRef: SaleRef.of(row.saleRef),
      provider: row.provider as PspSlug,
      amount: Money.of(row.amountMinor, row.currencyCode),
      captureMethod: row.captureMethod,
      status: row.status as PaymentIntentStatus,
      providerRef: row.providerIntentId ? ProviderRef.of(row.provider, row.providerIntentId) : undefined,
      captureResult,
      refundRecords: [],
      checkoutSnapshot: row.checkoutSnapshot ?? undefined,
      stripeCustomerId: row.stripeCustomerId ?? undefined,
      stripePaymentMethodId: row.stripePaymentMethodId ?? undefined,
      captureDeferred: row.captureDeferred ?? false,
      handoffDeferred: row.handoffDeferred ?? false,
    });
  }
}
