import { Money } from '@/modules/shared-kernel/money';
import { OfferLineItem } from '../value-objects/offer-line-item';
import { AppliedCoupon } from '../value-objects/applied-coupon';

export class CartPricingService {
  computeTotal(lines: OfferLineItem[], coupon: AppliedCoupon | null): Money {
    if (lines.length === 0) throw new Error('Cannot price an empty cart');
    const currency = lines[0].unitPrice.amount.currencyCode;
    let subtotal = Money.of(0, currency);
    for (const line of lines) {
      if (line.unitPrice.amount.currencyCode !== currency) {
        throw new Error('Cart contains mixed currencies');
      }
      subtotal = subtotal.add(line.lineTotal());
    }
    if (!coupon) return subtotal;
    const discounted = subtotal.amountMinor - coupon.discount.amountMinor;
    return Money.of(Math.max(0, discounted), currency);
  }
}
