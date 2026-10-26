import { describe, it, expect } from 'vitest';
import { PaymentIntent } from '../payment-intent';
import { SaleRef, CaptureMethod } from '../value-objects';
import { Money } from '../../../shared-kernel/money';

describe('PaymentIntent vault ref', () => {
  it('stores and rehydrates a generic vault ref', () => {
    const i = PaymentIntent.create({ id: 'i1', saleRef: SaleRef.of('s1'), provider: 'ACME', amount: Money.of(100, 'USD'), captureMethod: CaptureMethod.AUTOMATIC });
    i.setVaultRef('agr_1');
    expect(i.vaultRef).toBe('agr_1');
    const r = PaymentIntent.rehydrate({ id: 'i1', saleRef: SaleRef.of('s1'), provider: 'ACME', amount: Money.of(100, 'USD'), captureMethod: CaptureMethod.AUTOMATIC, status: 'PROCESSING', refundRecords: [], vaultRef: 'agr_2' });
    expect(r.vaultRef).toBe('agr_2');
  });
});
