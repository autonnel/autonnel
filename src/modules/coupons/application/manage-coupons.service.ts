import { Coupon, normalizeCode, type EvaluateResult } from '../domain/coupon';
import type { CouponRepository } from './ports';

export interface CouponInput {
  name: string;
  code: string;
  discountType: string;
  discountValue: number;
  minOrderAmount?: number | null;
  maxUsages?: number | null;
  isActive?: boolean;
  expiresAt?: Date | null;
}

export class ManageCouponsService {
  constructor(
    private readonly repo: CouponRepository,
    private readonly tenantId: () => string,
  ) {}

  async list(): Promise<Coupon[]> {
    return this.repo.list();
  }

  async create(input: CouponInput): Promise<Coupon> {
    const coupon = Coupon.create({ tenantId: this.tenantId(), ...input });
    if (await this.repo.findByCode(coupon.code)) {
      throw new CouponCodeConflictError(coupon.code);
    }
    return this.repo.create(coupon);
  }

  async update(id: string, input: CouponInput): Promise<Coupon> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new CouponNotFoundError(id);
    const nextCode = normalizeCode(input.code);
    if (nextCode !== existing.code) {
      const duplicate = await this.repo.findByCode(nextCode);
      if (duplicate && duplicate.id !== id) throw new CouponCodeConflictError(nextCode);
    }
    existing.applyEdit(input);
    return this.repo.update(existing);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new CouponNotFoundError(id);
    await this.repo.delete(id);
  }

  // Called once per paid order to advance usageCount toward maxUsages. No-op for unknown codes.
  async redeem(code: string): Promise<void> {
    let normalized: string;
    try {
      normalized = normalizeCode(code);
    } catch {
      return;
    }
    await this.repo.incrementUsage(normalized);
  }

  // Reused by the storefront coupon-validate endpoint (Shop area).
  async evaluate(code: string, subtotalMinor: number, now: Date = new Date()): Promise<EvaluateResult & { coupon?: Coupon }> {
    let normalized: string;
    try {
      normalized = normalizeCode(code);
    } catch {
      return { valid: false, discountMinor: 0, error: 'Invalid coupon code' };
    }
    const coupon = await this.repo.findByCode(normalized);
    if (!coupon) return { valid: false, discountMinor: 0, error: 'Coupon not found' };
    const result = coupon.evaluate(subtotalMinor, now);
    return result.valid ? { ...result, coupon } : result;
  }
}

export class CouponCodeConflictError extends Error {
  constructor(code: string) {
    super(`Coupon code "${code}" already exists`);
    this.name = 'CouponCodeConflictError';
  }
}

export class CouponNotFoundError extends Error {
  constructor(id: string) {
    super(`Coupon not found: ${id}`);
    this.name = 'CouponNotFoundError';
  }
}
