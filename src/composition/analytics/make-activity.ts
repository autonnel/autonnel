import { RecordActivityService } from '../../modules/analytics/application/record-activity.service';
import { PrismaActivityEventStore } from '../../modules/analytics/infra/prisma/activity-event.repository';
import type { ActivityIngestPort } from '../../modules/analytics/application/ports/inbound';
import { getTenantPrisma } from '../../modules/platform/infra/prisma-tenant-extension';

export function makeActivityIngest(): ActivityIngestPort {
  return new RecordActivityService({
    store: new PrismaActivityEventStore(getTenantPrisma().userActivityEvent as never),
  });
}
