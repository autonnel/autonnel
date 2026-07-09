import { Money } from '@/modules/shared-kernel/money';
import { AppliedCoupon, type CouponKind } from '../value-objects/applied-coupon';

export interface CouponDefinition {
  code: string;
  kind: CouponKind;
  value: number; // percent for 'percentage', minor units for 'fixed'
  minSubtotalMinor: number;
}

export class CouponEvaluationService {
  evaluate(def: CouponDefinition, subtotal: Money): AppliedCoupon {
    if (subtotal.amountMinor < def.minSubtotalMinor) {
      throw new Error('Subtotal below coupon minimum');
    }
    const raw =
      def.kind === 'percentage'
        ? Math.floor((subtotal.amountMinor * def.value) / 100)
        : def.value;
    const discountMinor = Math.min(raw, subtotal.amountMinor);
    return AppliedCoupon.create(def.code, def.kind, Money.of(discountMinor, subtotal.currencyCode));
  }
}
