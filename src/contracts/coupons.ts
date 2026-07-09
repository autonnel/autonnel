// Money fields are decimal-major strings on the wire.
export interface CouponDto {
  id: string;
  name: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: string;
  minOrderAmount: string | null;
  maxUsages: number | null;
  usageCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface CouponInputDto {
  name: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderAmount?: number | null;
  maxUsages?: number | null;
  isActive?: boolean;
  expiresAt?: string | null;
}

export interface CouponContracts {
  'GET /api/settings/coupons': { input: null; output: { coupons: CouponDto[] } };
  'POST /api/settings/coupons': { input: CouponInputDto; output: CouponDto };
  'PUT /api/settings/coupons/:id': { input: CouponInputDto; output: CouponDto };
  'DELETE /api/settings/coupons/:id': { input: null; output: { success: true } };
}
