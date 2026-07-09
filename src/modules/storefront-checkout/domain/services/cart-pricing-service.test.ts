import { describe, it, expect } from 'vitest';
import { Money } from '@/modules/shared-kernel/money';
import { ExternalRef } from '@/modules/shared-kernel/external-ref';
import { PriceSnapshot } from '../value-objects/price-snapshot';
import { OfferLineItem } from '../value-objects/offer-line-item';
import { AppliedCoupon } from '../value-objects/applied-coupon';
import { CartPricingService } from './cart-pricing-service';

const li = (minor: number, qty: number) =>
  OfferLineItem.create({
    variantExternalId: ExternalRef.of('gid://v/' + minor),
    title: 'x',
    quantity: qty,
    unitPrice: PriceSnapshot.create(Money.of(minor, 'USD'), new Date()),
  });

describe('CartPricingService', () => {
  const svc = new CartPricingService();

  it('sums line totals into a subtotal', () => {
    const total = svc.computeTotal([li(1000, 2), li(500, 1)], null);
    expect(total.amountMinor).toBe(2500);
  });

  it('applies a coupon discount but never below zero', () => {
    const total = svc.computeTotal([li(1000, 1)], AppliedCoupon.create('X', 'fixed', Money.of(1500, 'USD')));
    expect(total.amountMinor).toBe(0);
  });

  it('rejects mixed currencies', () => {
    const usd = li(1000, 1);
    const eur = OfferLineItem.create({
      variantExternalId: ExternalRef.of('gid://v/eur'),
      title: 'x',
      quantity: 1,
      unitPrice: PriceSnapshot.create(Money.of(1000, 'EUR'), new Date()),
    });
    expect(() => svc.computeTotal([usd, eur], null)).toThrow(/currenc/i);
  });

  it('rejects an empty cart', () => {
    expect(() => svc.computeTotal([], null)).toThrow(/empty/i);
  });
});
