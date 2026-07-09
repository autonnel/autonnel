import { ApiError } from '@/lib/api/define-route';
import type { Coupon } from '@/modules/coupons/domain/coupon';
import type { CouponInput } from '@/modules/coupons/application/manage-coupons.service';
import type { CouponDto, CouponInputDto } from '@/contracts/coupons';

export function toCouponDto(c: Coupon): CouponDto {
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    discountType: c.discountType,
    discountValue: c.discountValue.toString(),
    minOrderAmount: c.minOrderAmount === null ? null : c.minOrderAmount.toString(),
    maxUsages: c.maxUsages,
    usageCount: c.usageCount,
    isActive: c.isActive,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}

export function parseCouponInput(body: CouponInputDto | null): CouponInput {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'Invalid request body');
  if (typeof body.name !== 'string' || !body.name.trim()) throw new ApiError(400, 'name is required');
  if (typeof body.code !== 'string' || !body.code.trim()) throw new ApiError(400, 'code is required');
  if (body.discountType !== 'PERCENTAGE' && body.discountType !== 'FIXED_AMOUNT') {
    throw new ApiError(400, 'discountType must be PERCENTAGE or FIXED_AMOUNT');
  }
  if (typeof body.discountValue !== 'number') throw new ApiError(400, 'discountValue must be a number');
  return {
    name: body.name,
    code: body.code,
    discountType: body.discountType,
    discountValue: body.discountValue,
    minOrderAmount: body.minOrderAmount ?? null,
    maxUsages: body.maxUsages ?? null,
    isActive: body.isActive,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
  };
}
