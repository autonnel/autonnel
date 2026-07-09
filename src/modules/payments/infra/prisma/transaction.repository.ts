import { RefundTransaction } from '../../domain/refund-transaction';
import type { RefundKind } from '../../domain/value-objects';
import { Money } from '../../../shared-kernel/money';
import { getCurrentTenantId } from '../../../../lib/tenant/context';
import type {
  TransactionRepositoryPort,
  ReserveRefundInput,
  ReserveRefundResult,
  ChargeRow,
} from '../../application/ports/outbound';

export class PrismaTransactionRepository implements TransactionRepositoryPort {
  constructor(private readonly prisma: any) {}

  async reserveRefund(input: ReserveRefundInput): Promise<ReserveRefundResult> {
    const tenantId = getCurrentTenantId();
    return this.prisma.$transaction(async (tx: any) => {
      // Serialize concurrent refunds for the same intent: hold a row lock on the parent until commit,
      // so the prior-refund sum read below cannot be stale relative to another in-flight reservation.
      await tx.$queryRaw`SELECT id FROM payment_intents WHERE id = ${input.parentTransactionId} FOR UPDATE`;

      const existing = await tx.transaction.findFirst({
        where: { tenantId, idempotencyKey: input.idempotencyKey, type: 'REFUND' },
      });
      if (existing) return { status: 'duplicate', refund: this.toDomain(existing) };

      const agg = await tx.transaction.aggregate({
        where: { tenantId, parentTransactionId: input.parentTransactionId, chargeRef: input.chargeRef, type: 'REFUND', status: { not: 'FAILED' } },
        _sum: { amountMinor: true },
      });
      const priorMinor = agg?._sum?.amountMinor ?? 0;

      const decided = input.decide(priorMinor); // throws (e.g. RefundExceedsCapturedError) -> rolls back

      await tx.transaction.create({
        data: {
          id: decided.id,
          tenantId,
          type: 'REFUND',
          status: 'PENDING',
          parentTransactionId: input.parentTransactionId,
          chargeRef: input.chargeRef,
          refundKind: decided.kind,
          amountMinor: decided.amount.amountMinor,
          currencyCode: decided.amount.currencyCode,
          provider: 'STRIPE',
          providerRefundRef: null,
          idempotencyKey: input.idempotencyKey,
          reason: decided.reason ?? null,
        },
      });

      return {
        status: 'reserved',
        refund: RefundTransaction.create({
          id: decided.id,
          parentTransactionId: input.parentTransactionId,
          kind: decided.kind,
          amount: decided.amount,
          reason: decided.reason,
        }),
      };
    });
  }

  async settleRefund(refundId: string, providerRefundRef: string): Promise<void> {
    await this.prisma.transaction.updateMany({
      where: { tenantId: getCurrentTenantId(), id: refundId },
      data: { status: 'SUCCEEDED', providerRefundRef },
    });
  }

  async failRefund(refundId: string): Promise<void> {
    await this.prisma.transaction.updateMany({
      where: { tenantId: getCurrentTenantId(), id: refundId },
      data: { status: 'FAILED' },
    });
  }

  async listCharges(intentId: string): Promise<ChargeRow[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { tenantId: getCurrentTenantId(), parentTransactionId: intentId, type: 'CHARGE', status: 'SUCCEEDED' },
      orderBy: { createdAt: 'asc' },
    });
    // Legacy CHARGE rows predate chargeRef; fall back to providerRefundRef (which holds the charge id).
    return rows
      .map((r: any) => ({ chargeRef: (r.chargeRef ?? r.providerRefundRef) as string | null, amountMinor: r.amountMinor as number, currencyCode: r.currencyCode as string }))
      .filter((c: { chargeRef: string | null }) => !!c.chargeRef) as ChargeRow[];
  }

  private toDomain(row: any): RefundTransaction {
    const t = RefundTransaction.create({
      id: row.id,
      parentTransactionId: row.parentTransactionId,
      kind: row.refundKind as RefundKind,
      amount: Money.of(row.amountMinor, row.currencyCode),
      reason: row.reason ?? undefined,
    });
    if (row.providerRefundRef) t.acknowledge(row.providerRefundRef);
    return t;
  }
}
