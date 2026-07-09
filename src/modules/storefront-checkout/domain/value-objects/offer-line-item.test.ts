import { describe, it, expect } from 'vitest';
import { Money } from '@/modules/shared-kernel/money';
import { ExternalRef } from '@/modules/shared-kernel/external-ref';
import { PriceSnapshot } from './price-snapshot';
import { OfferLineItem } from './offer-line-item';

describe('OfferLineItem', () => {
  const ref = ExternalRef.of('gid://shopify/ProductVariant/1');
  const price = PriceSnapshot.create(Money.of(1999, 'USD'), new Date());

  it('computes line total as unit price * quantity', () => {
    const li = OfferLineItem.create({ variantExternalId: ref, title: 'Widget', quantity: 3, unitPrice: price });
    expect(li.lineTotal().amountMinor).toBe(5997);
    expect(li.lineTotal().currencyCode).toBe('USD');
  });

  it('rejects a non-positive quantity', () => {
    expect(() => OfferLineItem.create({ variantExternalId: ref, title: 'W', quantity: 0, unitPrice: price })).toThrow(/quantity/i);
  });

  it('never embeds an owned product — only the opaque ExternalRef', () => {
    const li = OfferLineItem.create({ variantExternalId: ref, title: 'W', quantity: 1, unitPrice: price });
    expect(li.variantExternalId.toString()).toBe('gid://shopify/ProductVariant/1');
  });
});
