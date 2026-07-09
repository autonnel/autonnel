import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeCoupons } from '@/composition/make-coupons';
import { CouponCodeConflictError } from '@/modules/coupons/application/manage-coupons.service';
import { toCouponDto, parseCouponInput } from './_dto';

export const GET = defineRoute('GET /api/settings/coupons', { feature: 'SETTINGS_COUPON' }, async () => {
  const coupons = makeCoupons();
  const rows = await coupons.list();
  return { coupons: rows.map(toCouponDto) };
});

export const POST = defineRoute('POST /api/settings/coupons', { feature: 'SETTINGS_COUPON', status: 201 }, async ({ input }) => {
  const coupons = makeCoupons();
  try {
    const created = await coupons.create(parseCouponInput(input));
    return toCouponDto(created);
  } catch (err) {
    if (err instanceof CouponCodeConflictError) throw new ApiError(409, err.message);
    if (err instanceof Error) throw new ApiError(400, err.message);
    throw err;
  }
});
