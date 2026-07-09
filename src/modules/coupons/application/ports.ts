import type { Coupon } from '../domain/coupon';

export interface CouponRepository {
  list(): Promise<Coupon[]>;
  findById(id: string): Promise<Coupon | null>;
  findByCode(code: string): Promise<Coupon | null>;
  create(coupon: Coupon): Promise<Coupon>;
  update(coupon: Coupon): Promise<Coupon>;
  delete(id: string): Promise<void>;
  incrementUsage(code: string): Promise<void>;
}
