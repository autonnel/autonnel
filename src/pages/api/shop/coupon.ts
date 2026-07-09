import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeCoupons } from '@/composition/make-coupons';

// subtotal arrives decimal-major; the domain evaluates in minor units; discount is returned decimal-major.
export const GET = defineRoute('GET /api/shop/coupon', {}, async ({ query }) => {
  const code = query.get('code');
  const subtotalParam = query.get('subtotal');
  if (!code) throw new ApiError(400, 'Coupon code is required');
  if (!subtotalParam) throw new ApiError(400, 'Subtotal is required');

  const subtotal = parseFloat(subtotalParam);
  if (Number.isNaN(subtotal) || subtotal < 0) throw new ApiError(400, 'Invalid subtotal value');

  const result = await makeCoupons().evaluate(code, Math.round(subtotal * 100));
  if (!result.valid || !result.coupon) {
    return { valid: false as const, error: result.error || 'Invalid coupon' };
  }

  return {
    valid: true as const,
    discount: result.discountMinor / 100,
    discountType: result.coupon.discountType,
    discountValue: Number(result.coupon.discountValue),
    couponId: result.coupon.id,
    code: result.coupon.code,
  };
});
