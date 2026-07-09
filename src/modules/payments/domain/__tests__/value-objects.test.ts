import { describe, it, expect } from 'vitest';
import {
  ProviderRef,
  CaptureResult,
  SaleRef,
  RefundKind,
  PaymentError,
} from '../value-objects';
import { Money } from '../../../shared-kernel/money';

describe('payments value objects', () => {
  it('SaleRef is an opaque immutable wrapper and never dereferences the Sale', () => {
    const ref = SaleRef.of('sale_123');
    expect(ref.value).toBe('sale_123');
    expect(() => SaleRef.of('')).toThrow('SaleRef requires a non-empty value');
  });

  it('ProviderRef binds exactly one PSP slug + provider intent id', () => {
    const ref = ProviderRef.of('STRIPE', 'pi_abc');
    expect(ref.provider).toBe('STRIPE');
    expect(ref.providerIntentId).toBe('pi_abc');
  });

  it('CaptureResult carries a display-safe card snapshot and a captured Money', () => {
    const result = CaptureResult.of({
      providerChargeId: 'ch_1',
      capturedAmount: Money.of(1999, 'USD'),
      cardBrand: 'visa',
      last4: '4242',
      capturedAt: new Date('2026-06-04T00:00:00Z'),
    });
    expect(result.capturedAmount.amountMinor).toBe(1999);
    expect(result.last4).toBe('4242');
  });

  it('RefundKind enumerates full | fixed | percentage', () => {
    expect(RefundKind.FULL).toBe('full');
    expect(RefundKind.FIXED).toBe('fixed');
    expect(RefundKind.PERCENTAGE).toBe('percentage');
  });

  it('PaymentError normalizes a decline into a typed, vendor-agnostic taxonomy', () => {
    const err = PaymentError.fromDecline('card_declined', 'do_not_honor');
    expect(err.code).toBe('card_declined');
    expect(err.retryable).toBe(false);
  });
});
