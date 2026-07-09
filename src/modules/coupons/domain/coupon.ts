// Money is stored as a decimal major-unit string at the boundary but evaluation works in integer minor units to avoid float drift.

export const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export function isDiscountType(v: unknown): v is DiscountType {
  return typeof v === 'string' && (DISCOUNT_TYPES as readonly string[]).includes(v);
}

const CODE_RE = /^[A-Z0-9_-]+$/;

export function normalizeCode(raw: string): string {
  const code = raw.toUpperCase().trim();
  if (!code) throw new Error('code is required');
  if (!CODE_RE.test(code)) throw new Error('code must contain only letters, numbers, hyphens, and underscores');
  return code;
}

export interface EvaluateResult {
  valid: boolean;
  discountMinor: number;
  error?: string;
}

export class Coupon {
  private constructor(
    public id: string,
    readonly tenantId: string,
    public name: string,
    public code: string,
    public discountType: DiscountType,
    public discountValue: number,
    public minOrderAmount: number | null,
    public maxUsages: number | null,
    public usageCount: number,
    public isActive: boolean,
    public expiresAt: Date | null,
    readonly createdAt: Date,
  ) {}

  static create(input: {
    tenantId: string;
    name: string;
    code: string;
    discountType: string;
    discountValue: number;
    minOrderAmount?: number | null;
    maxUsages?: number | null;
    isActive?: boolean;
    expiresAt?: Date | null;
  }): Coupon {
    const name = input.name.trim();
    if (!name) throw new Error('name is required');
    const code = normalizeCode(input.code);
    if (!isDiscountType(input.discountType)) throw new Error('discountType must be PERCENTAGE or FIXED_AMOUNT');
    validateValue(input.discountType, input.discountValue);
    return new Coupon(
      '',
      input.tenantId,
      name,
      code,
      input.discountType,
      input.discountValue,
      input.minOrderAmount ?? null,
      input.maxUsages ?? null,
      0,
      input.isActive !== false,
      input.expiresAt ?? null,
      new Date(),
    );
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    name: string;
    code: string;
    discountType: DiscountType;
    discountValue: number;
    minOrderAmount: number | null;
    maxUsages: number | null;
    usageCount: number;
    isActive: boolean;
    expiresAt: Date | null;
    createdAt: Date;
  }): Coupon {
    return new Coupon(
      input.id,
      input.tenantId,
      input.name,
      input.code,
      input.discountType,
      input.discountValue,
      input.minOrderAmount,
      input.maxUsages,
      input.usageCount,
      input.isActive,
      input.expiresAt,
      input.createdAt,
    );
  }

  applyEdit(patch: {
    name: string;
    code: string;
    discountType: string;
    discountValue: number;
    minOrderAmount?: number | null;
    maxUsages?: number | null;
    isActive?: boolean;
    expiresAt?: Date | null;
  }): void {
    const name = patch.name.trim();
    if (!name) throw new Error('name is required');
    if (!isDiscountType(patch.discountType)) throw new Error('discountType must be PERCENTAGE or FIXED_AMOUNT');
    validateValue(patch.discountType, patch.discountValue);
    this.name = name;
    this.code = normalizeCode(patch.code);
    this.discountType = patch.discountType;
    this.discountValue = patch.discountValue;
    this.minOrderAmount = patch.minOrderAmount ?? null;
    this.maxUsages = patch.maxUsages ?? null;
    this.isActive = patch.isActive !== false;
    this.expiresAt = patch.expiresAt ?? null;
  }

  isExhausted(): boolean {
    return this.maxUsages !== null && this.usageCount >= this.maxUsages;
  }

  isExpired(at: Date): boolean {
    return this.expiresAt !== null && this.expiresAt.getTime() < at.getTime();
  }

  // subtotalMinor is in integer minor units (e.g. cents). Returns the discount to
  // apply, also in minor units, clamped so it never exceeds the subtotal.
  evaluate(subtotalMinor: number, now: Date = new Date()): EvaluateResult {
    if (!this.isActive) return invalid('Coupon is not active');
    if (this.isExpired(now)) return invalid('Coupon has expired');
    if (this.isExhausted()) return invalid('Coupon usage limit reached');
    if (this.minOrderAmount !== null && subtotalMinor < majorToMinor(this.minOrderAmount)) {
      return invalid(`Order must be at least ${this.minOrderAmount}`);
    }

    let discountMinor: number;
    if (this.discountType === 'PERCENTAGE') {
      discountMinor = Math.round((subtotalMinor * this.discountValue) / 100);
    } else {
      discountMinor = majorToMinor(this.discountValue);
    }
    discountMinor = Math.min(discountMinor, subtotalMinor);
    return { valid: true, discountMinor };
  }
}

function validateValue(type: DiscountType, value: number): void {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    throw new Error('discountValue must be a positive number');
  }
  if (type === 'PERCENTAGE' && value > 100) {
    throw new Error('Percentage discount cannot exceed 100');
  }
}

function majorToMinor(major: number): number {
  return Math.round(major * 100);
}

function invalid(error: string): EvaluateResult {
  return { valid: false, discountMinor: 0, error };
}
