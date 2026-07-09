import { describe, it, expect, vi } from 'vitest';
import { PrismaPaymentIntentRepository } from '../payment-intent.repository';
import { PaymentIntent } from '../../../domain/payment-intent';
import { SaleRef, CaptureMethod, CaptureResult } from '../../../domain/value-objects';
import { Money } from '../../../../shared-kernel/money';

function fakePrisma() {
  const rows = new Map<string, any>();
  const transactions: any[] = [];
  return {
    rows,
    transactions,
    paymentIntent: {
      upsert: vi.fn(async ({ where, create, update }: any) => { rows.set(where.id ?? create.id, { ...(rows.get(where.id) ?? create), ...update }); }),
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id) return rows.get(where.id) ?? null;
        if (where.provider_providerIntentId) {
          for (const r of rows.values()) if (r.provider === where.provider_providerIntentId.provider && r.providerIntentId === where.provider_providerIntentId.providerIntentId) return r;
        }
        if (where.tenantId_saleRef) {
          for (const r of rows.values()) if (r.saleRef === where.tenantId_saleRef.saleRef) return r;
        }
        return null;
      }),
    },
    transaction: {
      create: vi.fn(async ({ data }: any) => {
        if (transactions.some((t) => t.idempotencyKey === data.idempotencyKey)) {
          throw Object.assign(new Error('Unique constraint'), { code: 'P2002' });
        }
        transactions.push(data);
        return data;
      }),
    },
  };
}

describe('PrismaPaymentIntentRepository', () => {
  it('saves and rehydrates a captured intent with its CaptureResult and refunds', async () => {
    const prisma = fakePrisma();
    const repo = new PrismaPaymentIntentRepository(prisma as any);
    const intent = PaymentIntent.create({ id: 'int_1', saleRef: SaleRef.of('sale_1'), provider: 'STRIPE', amount: Money.of(1999, 'USD'), captureMethod: CaptureMethod.AUTOMATIC });
    intent.bindProvider({ provider: 'STRIPE', providerIntentId: 'pi_1' } as any);
    intent.markCaptured(CaptureResult.of({ providerChargeId: 'ch_1', capturedAmount: Money.of(1999, 'USD'), last4: '4242', capturedAt: new Date('2026-06-04') }));
    await repo.save(intent);

    const loaded = await repo.findById('int_1');
    expect(loaded?.status).toBe('CAPTURED');
    expect(loaded?.captureResult?.last4).toBe('4242');

    const byProvider = await repo.findByProviderRef('STRIPE', 'pi_1');
    expect(byProvider?.id).toBe('int_1');
  });

  it('records a SUCCEEDED CHARGE transaction when a captured intent is saved', async () => {
    const prisma = fakePrisma();
    const repo = new PrismaPaymentIntentRepository(prisma as any);
    const intent = PaymentIntent.create({ id: 'int_2', saleRef: SaleRef.of('sale_2'), provider: 'PAYPAL', amount: Money.of(4200, 'EUR'), captureMethod: CaptureMethod.AUTOMATIC });
    intent.bindProvider({ provider: 'PAYPAL', providerIntentId: 'po_2' } as any);
    intent.markCaptured(CaptureResult.of({ providerChargeId: 'cap_2', capturedAmount: Money.of(4200, 'EUR'), capturedAt: new Date('2026-06-13') }));
    await repo.save(intent);

    expect(prisma.transactions).toHaveLength(1);
    expect(prisma.transactions[0]).toMatchObject({
      type: 'CHARGE',
      status: 'SUCCEEDED',
      amountMinor: 4200,
      currencyCode: 'EUR',
      provider: 'PAYPAL',
      providerRefundRef: 'cap_2',
      idempotencyKey: 'charge:int_2',
    });
  });

  it('does not write a CHARGE for a non-captured intent', async () => {
    const prisma = fakePrisma();
    const repo = new PrismaPaymentIntentRepository(prisma as any);
    const intent = PaymentIntent.create({ id: 'int_3', saleRef: SaleRef.of('sale_3'), provider: 'STRIPE', amount: Money.of(1000, 'USD'), captureMethod: CaptureMethod.AUTOMATIC });
    intent.bindProvider({ provider: 'STRIPE', providerIntentId: 'pi_3' } as any);
    intent.markProcessing();
    await repo.save(intent);
    expect(prisma.transactions).toHaveLength(0);
  });

  it('is idempotent: re-saving a captured intent does not duplicate the CHARGE', async () => {
    const prisma = fakePrisma();
    const repo = new PrismaPaymentIntentRepository(prisma as any);
    const intent = PaymentIntent.create({ id: 'int_4', saleRef: SaleRef.of('sale_4'), provider: 'STRIPE', amount: Money.of(1999, 'USD'), captureMethod: CaptureMethod.AUTOMATIC });
    intent.bindProvider({ provider: 'STRIPE', providerIntentId: 'pi_4' } as any);
    intent.markCaptured(CaptureResult.of({ providerChargeId: 'ch_4', capturedAmount: Money.of(1999, 'USD'), capturedAt: new Date('2026-06-13') }));
    await repo.save(intent);
    intent.recordRefund({ transactionId: 'r_4', amount: Money.of(500, 'USD') });
    await repo.save(intent);
    expect(prisma.transactions).toHaveLength(1);
  });
});
