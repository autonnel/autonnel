import { describe, it, expect, vi } from 'vitest';
import { PrismaPaymentIntentRepository } from '../payment-intent.repository';
import { PaymentIntent } from '../../../domain/payment-intent';
import { SaleRef, CaptureMethod } from '../../../domain/value-objects';
import { Money } from '../../../../shared-kernel/money';

vi.mock('../../../../../lib/tenant/context', () => ({ getCurrentTenantId: () => 'default' }));

describe('PrismaPaymentIntentRepository atomic helpers', () => {
  it('claimCapture only succeeds for the single updater', async () => {
    const updateMany = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const repo = new PrismaPaymentIntentRepository({ paymentIntent: { updateMany } } as never);
    expect(await repo.claimCapture('i1')).toBe(true);
    expect(await repo.claimCapture('i1')).toBe(false);
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'i1', status: { in: ['REQUIRES_PAYMENT', 'PROCESSING'] } }, data: { status: 'CAPTURED' } });
  });

  it('cancels stale processing intents', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 3 });
    const repo = new PrismaPaymentIntentRepository({ paymentIntent: { updateMany } } as never);
    const cutoff = new Date('2026-10-12T00:00:00Z');
    expect(await repo.cancelStaleProcessing(cutoff)).toBe(3);
    expect(updateMany).toHaveBeenCalledWith({ where: { status: 'PROCESSING', updatedAt: { lt: cutoff } }, data: { status: 'CANCELED' } });
  });

  it('orders stale processing oldest first so abandoned rows cannot starve the batch', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new PrismaPaymentIntentRepository({ paymentIntent: { findMany } } as never);
    await repo.findStaleProcessing(new Date(), 50);
    expect(findMany.mock.calls[0][0].orderBy).toEqual({ updatedAt: 'asc' });
  });

  it('releaseCapture only reverts claims that never recorded a charge', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repo = new PrismaPaymentIntentRepository({ paymentIntent: { updateMany } } as never);
    await repo.releaseCapture('i1');
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'i1', status: 'CAPTURED', providerChargeId: null }, data: { status: 'PROCESSING' } });
  });

  it('save never writes vaultRef when the intent has none', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const repo = new PrismaPaymentIntentRepository({ paymentIntent: { upsert } } as never);
    const intent = PaymentIntent.create({ id: 'i1', saleRef: SaleRef.of('s1'), provider: 'ACME', amount: Money.of(100, 'USD'), captureMethod: CaptureMethod.AUTOMATIC });
    await repo.save(intent);
    expect('vaultRef' in upsert.mock.calls[0][0].update).toBe(false);
    intent.setVaultRef('agr_1');
    await repo.save(intent);
    expect(upsert.mock.calls[1][0].update.vaultRef).toBe('agr_1');
  });
});
