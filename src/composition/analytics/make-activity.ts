import { RecordActivityService } from '../../modules/analytics/application/record-activity.service';
import { RecordPageEngagementService } from '../../modules/analytics/application/record-page-engagement.service';
import { PrismaActivityEventStore } from '../../modules/analytics/infra/prisma/activity-event.repository';
import { PrismaPageEngagementStore } from '../../modules/analytics/infra/prisma/page-engagement.repository';
import type { ActivityIngestPort } from '../../modules/analytics/application/ports/inbound';
import { getTenantPrisma } from '../../modules/platform/infra/prisma-tenant-extension';

export function makeActivityIngest(): ActivityIngestPort {
  const db = getTenantPrisma();
  return new RecordActivityService({
    store: new PrismaActivityEventStore(db.userActivityEvent as never),
    engagement: new RecordPageEngagementService({
      store: new PrismaPageEngagementStore(db.pageEngagement as never),
    }),
  });
}
