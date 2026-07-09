import type { PrismaClient } from '@prisma/client';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { getBasePrisma } from '@/lib/db';
import { OutboxEventPublisher } from '@/modules/platform/infra/outbox-event-publisher';
import { TenantEventPublisher } from '@/modules/platform/infra/tenant-event-publisher';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { invalidatePageCache } from '@/lib/adapters/cache';

export function authoringDepsFromLocals(_locals?: unknown) {
  const base = getBasePrisma();
  const tenantEvents = new TenantEventPublisher(new OutboxEventPublisher(base));
  return {
    db: getTenantPrisma() as unknown as PrismaClient,
    events: {
      publish: (events: Array<{ type: string; payload: unknown }>) =>
        Promise.all(events.map((e) => tenantEvents.publish(e))).then(() => undefined),
    },
    tenantId: getCurrentTenantId(),
    invalidatePageCache,
  };
}
