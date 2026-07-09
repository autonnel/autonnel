import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { invalidateGlobalScriptsCache } from '@/lib/adapters/cache';
import { PrismaDomainRepository } from '@/modules/site-config/infra/prisma/domain.repository';
import { PrismaGlobalScriptRepository } from '@/modules/site-config/infra/prisma/global-script.repository';
import { ManageDomainsService } from '@/modules/site-config/application/manage-domains.service';
import { ManageScriptsService } from '@/modules/site-config/application/manage-scripts.service';

export function makeSiteConfig() {
  const db = getTenantPrisma();
  return {
    domains: new ManageDomainsService(new PrismaDomainRepository(db), getCurrentTenantId),
    scripts: new ManageScriptsService(new PrismaGlobalScriptRepository(db), getCurrentTenantId, invalidateGlobalScriptsCache),
  };
}
