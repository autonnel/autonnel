import { Money } from '@/modules/shared-kernel/money';

export type CouponKind = 'percentage' | 'fixed';

export class AppliedCoupon {
  private constructor(
    readonly code: string,
    readonly kind: CouponKind,
    readonly discount: Money,
  ) {}

  static create(code: string, kind: CouponKind, discount: Money): AppliedCoupon {
    if (!code.trim()) throw new Error('AppliedCoupon requires a code');
    if (discount.amountMinor < 0) throw new Error('AppliedCoupon discount must be >= 0');
    return new AppliedCoupon(code.trim(), kind, discount);
  }
}
