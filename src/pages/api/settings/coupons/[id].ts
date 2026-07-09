import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeCoupons } from '@/composition/make-coupons';
import { CouponCodeConflictError, CouponNotFoundError } from '@/modules/coupons/application/manage-coupons.service';
import { toCouponDto, parseCouponInput } from './_dto';

export const PUT = defineRoute('PUT /api/settings/coupons/:id', { feature: 'SETTINGS_COUPON' }, async ({ input, params }) => {
  const id = params.id;
  if (!id) throw new ApiError(400, 'Coupon ID is required');
  const coupons = makeCoupons();
  try {
    const updated = await coupons.update(id, parseCouponInput(input));
    return toCouponDto(updated);
  } catch (err) {
    if (err instanceof CouponNotFoundError) throw new ApiError(404, 'Coupon not found');
    if (err instanceof CouponCodeConflictError) throw new ApiError(409, err.message);
    if (err instanceof ApiError) throw err;
    if (err instanceof Error) throw new ApiError(400, err.message);
    throw err;
  }
});

export const DELETE = defineRoute('DELETE /api/settings/coupons/:id', { feature: 'SETTINGS_COUPON' }, async ({ params }) => {
  const id = params.id;
  if (!id) throw new ApiError(400, 'Coupon ID is required');
  const coupons = makeCoupons();
  try {
    await coupons.delete(id);
  } catch (err) {
    if (err instanceof CouponNotFoundError) throw new ApiError(404, 'Coupon not found');
    throw err;
  }
  return { success: true } as const;
});
