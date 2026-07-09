import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { PrismaCouponRepository } from '@/modules/coupons/infra/prisma/coupon.repository';
import { ManageCouponsService } from '@/modules/coupons/application/manage-coupons.service';

export function makeCoupons() {
  const db = getTenantPrisma();
  return new ManageCouponsService(new PrismaCouponRepository(db), getCurrentTenantId);
}
