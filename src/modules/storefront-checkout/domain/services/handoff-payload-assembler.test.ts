import { describe, it, expect } from 'vitest';
import { Money } from '@/modules/shared-kernel/money';
import { IdempotencyKey } from '@/modules/shared-kernel/idempotency-key';
import { HandoffPayloadAssembler } from './handoff-payload-assembler';
import type { CheckoutSnapshot } from '../../application/checkout-snapshot';

function snapshot(): CheckoutSnapshot {
  return {
    sessionId: 'sess_1',
    visitorId: null,
    funnelId: null,
    locale: null,
    buyer: {
      fullName: 'Ada',
      address: { line1: '1 Market', city: 'SF', countryCode: 'US', postalCode: '94105' },
      channel: 'email',
      normalized: 'ada@example.com',
      hashedIdentity: 'h:ada@example.com',
    },
    lines: [
      {
        variantExternalId: 'gid://v/1',
        title: 'Widget',
        quantity: 2,
        unitPriceMinor: 1000,
        currencyCode: 'USD',
        capturedAt: new Date().toISOString(),
      },
    ],
  };
}

describe('HandoffPayloadAssembler', () => {
  const assembler = new HandoffPayloadAssembler((t, s) => IdempotencyKey.of(`${t}:${s}`));

  it('builds a payload from the checkout snapshot whose grandTotal equals the captured total', () => {
    const payload = assembler.fromSnapshot({
      tenantId: 'default',
      saleRef: 'sale_1',
      snapshot: snapshot(),
      capturedTotal: Money.of(2000, 'USD'),
    });
    expect(payload.grandTotal.amountMinor).toBe(2000);
    expect(payload.lines[0].variantExternalId).toBe('gid://v/1');
    expect(payload.lines[0].quantity).toBe(2);
    expect(payload.idempotencyKey.value).toBe('default:sale_1');
    expect(payload.customer.fullName).toBe('Ada');
    expect(payload.customer.hashedIdentity).toBe('h:ada@example.com');
    expect((payload.customer.shippingAddress as { countryCode: string }).countryCode).toBe('US');
  });

  it('omits appliedDiscount when no coupon was applied', () => {
    const payload = assembler.fromSnapshot({
      tenantId: 'default',
      saleRef: 'sale_1',
      snapshot: snapshot(),
      capturedTotal: Money.of(2000, 'USD'),
    });
    expect(payload.appliedDiscount).toBeUndefined();
  });

  it('carries the coupon discount as the gap between line subtotal and captured total', () => {
    const payload = assembler.fromSnapshot({
      tenantId: 'default',
      saleRef: 'sale_1',
      snapshot: { ...snapshot(), couponCode: 'SAVE5' },
      capturedTotal: Money.of(1500, 'USD'),
    });
    expect(payload.appliedDiscount).toEqual({ amountMinor: 500, currencyCode: 'USD', code: 'SAVE5' });
  });

  it('omits the discount for a filtered split-handoff that charges the line subtotal exactly', () => {
    const payload = assembler.fromSnapshot({
      tenantId: 'default',
      saleRef: 'sale_1',
      snapshot: { ...snapshot(), couponCode: 'SAVE5' },
      capturedTotal: Money.of(2000, 'USD'),
    });
    expect(payload.appliedDiscount).toBeUndefined();
  });
});
