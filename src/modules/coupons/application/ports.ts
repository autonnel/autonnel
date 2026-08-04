import type { Coupon } from '../domain/coupon';

export interface CouponRepository {
  list(): Promise<Coupon[]>;
  findById(id: string): Promise<Coupon | null>;
  findByCode(code: string): Promise<Coupon | null>;
  create(coupon: Coupon): Promise<Coupon>;
  update(coupon: Coupon): Promise<Coupon>;
  delete(id: string): Promise<void>;
  /** Advances usageCount only while below maxUsages. Returns false when the cap is reached. */
  incrementUsage(code: string): Promise<boolean>;
}
