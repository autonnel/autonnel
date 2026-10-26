import { Money } from '@/modules/shared-kernel/money';
import { AppliedCoupon, type CouponKind } from '../value-objects/applied-coupon';

export interface CouponDefinition {
  code: string;
  kind: CouponKind;
  value: number; // percent for 'percentage', minor units for 'fixed'
  minSubtotalMinor: number;
}

export interface CouponMinimum {
  amountMinor: number;
  currencyCode: string;
}

export class SubtotalBelowMinimumError extends Error {
  readonly minOrder: CouponMinimum;

  constructor(amountMinor: number, currencyCode: string) {
    super('Subtotal below coupon minimum');
    this.name = 'SubtotalBelowMinimumError';
    this.minOrder = { amountMinor, currencyCode: currencyCode.toUpperCase() };
  }
}

export class CouponEvaluationService {
  evaluate(def: CouponDefinition, subtotal: Money): AppliedCoupon {
    if (subtotal.amountMinor < def.minSubtotalMinor) {
      throw new SubtotalBelowMinimumError(def.minSubtotalMinor, subtotal.currencyCode);
    }
    const raw =
      def.kind === 'percentage'
        ? Math.floor((subtotal.amountMinor * def.value) / 100)
        : def.value;
    const discountMinor = Math.min(raw, subtotal.amountMinor);
    return AppliedCoupon.create(def.code, def.kind, Money.of(discountMinor, subtotal.currencyCode));
  }
}
