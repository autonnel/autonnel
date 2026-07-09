// tenantId is auto-injected by the Prisma extension on every write/where.
import { Coupon, type DiscountType } from '../../domain/coupon';
import type { CouponRepository } from '../../application/ports';

type Client = ReturnType<typeof import('../../../platform/infra/prisma-tenant-extension').getTenantPrisma>;

type Row = {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  discountType: DiscountType;
  discountValue: { toString(): string };
  minOrderAmount: { toString(): string } | null;
  maxUsages: number | null;
  usageCount: number;
  isActive: boolean;
  expiresAt: Date | null;
  createdAt: Date;
};

function toDomain(row: Row): Coupon {
  return Coupon.rehydrate({
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    code: row.code,
    discountType: row.discountType,
    discountValue: Number(row.discountValue.toString()),
    minOrderAmount: row.minOrderAmount === null ? null : Number(row.minOrderAmount.toString()),
    maxUsages: row.maxUsages,
    usageCount: row.usageCount,
    isActive: row.isActive,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  });
}

function toData(coupon: Coupon) {
  return {
    name: coupon.name,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minOrderAmount: coupon.minOrderAmount,
    maxUsages: coupon.maxUsages,
    isActive: coupon.isActive,
    expiresAt: coupon.expiresAt,
  };
}

export class PrismaCouponRepository implements CouponRepository {
  constructor(private readonly db: Client) {}

  async list(): Promise<Coupon[]> {
    const rows = await this.db.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((r: Row) => toDomain(r));
  }

  async findById(id: string): Promise<Coupon | null> {
    const row = await this.db.coupon.findFirst({ where: { id } });
    return row ? toDomain(row as Row) : null;
  }

  async findByCode(code: string): Promise<Coupon | null> {
    const row = await this.db.coupon.findFirst({ where: { code } });
    return row ? toDomain(row as Row) : null;
  }

  async create(coupon: Coupon): Promise<Coupon> {
    const row = await this.db.coupon.create({ data: toData(coupon) as never });
    return toDomain(row as Row);
  }

  async update(coupon: Coupon): Promise<Coupon> {
    const row = await this.db.coupon.update({ where: { id: coupon.id }, data: toData(coupon) as never });
    return toDomain(row as Row);
  }

  async delete(id: string): Promise<void> {
    await this.db.coupon.delete({ where: { id } });
  }

  // Atomic so concurrent redemptions never lose a count; tenant scope is injected by the extension.
  async incrementUsage(code: string): Promise<void> {
    await this.db.coupon.updateMany({ where: { code }, data: { usageCount: { increment: 1 } } });
  }
}
