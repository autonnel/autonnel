import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { invalidateFunnelScriptsCache } from '@/lib/adapters/cache';
import { PrismaFunnelDashboardRepository } from '@/modules/funnel-dashboard/infra/prisma/funnel.repository';
import { PrismaFunnelScriptRepository } from '@/modules/funnel-dashboard/infra/prisma/funnel-script.repository';
import { PrismaExperimentRepository } from '@/modules/funnel-dashboard/infra/prisma/experiment.repository';
import { PrismaExperimentResultsRepository } from '@/modules/funnel-dashboard/infra/prisma/experiment-results.repository';
import { PrismaAbTestAssignmentRepository } from '@/modules/funnel-dashboard/infra/prisma/ab-test-assignment.repository';
import { ManageFunnelsService } from '@/modules/funnel-dashboard/application/manage-funnels.service';
import { ManageFunnelScriptsService } from '@/modules/funnel-dashboard/application/manage-funnel-scripts.service';
import { ManageExperimentService } from '@/modules/funnel-dashboard/application/manage-experiment.service';
import { ExperimentResultsService } from '@/modules/funnel-dashboard/application/results.service';

export function makeFunnelDashboard() {
  const db = getTenantPrisma();
  const experimentRepo = new PrismaExperimentRepository(db);
  return {
    funnels: new ManageFunnelsService(new PrismaFunnelDashboardRepository(db)),
    scripts: new ManageFunnelScriptsService(new PrismaFunnelScriptRepository(db), invalidateFunnelScriptsCache),
    experiments: new ManageExperimentService(experimentRepo),
    results: new ExperimentResultsService(new PrismaExperimentResultsRepository(db), experimentRepo),
    assignments: new PrismaAbTestAssignmentRepository(db),
  };
}
