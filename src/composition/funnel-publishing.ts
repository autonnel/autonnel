import type { PrismaClient } from '@prisma/client';
import { FunnelPublishingService } from '@/modules/authoring/application/funnel-publishing-service';
import { PrismaFunnelPublicationStore } from '@/modules/authoring/infra/prisma/funnel-publication-store';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FunnelPublishing');

type Steps = { stepSlug: string; pageId: string }[];

function makeService(db: PrismaClient): FunnelPublishingService {
  const store = new PrismaFunnelPublicationStore(db);
  return new FunnelPublishingService({ publications: store, pages: store });
}

// A failed snapshot must not fail the step edit that triggered it; checkout republishes on demand.
export function makeSafeFunnelPublisher(db: PrismaClient) {
  const service = makeService(db);
  return {
    async publish(funnel: { id: string; steps: readonly { stepSlug: string; pageId: string }[] }) {
      try {
        return await service.publish(funnel);
      } catch (error) {
        logger.warn('Failed to publish funnel snapshot', { error, funnelId: funnel.id });
        return null;
      }
    },
  };
}

// Funnels saved before snapshots existed (or edited outside the composing service) have no
// publication; checkout publishes the live funnel that owns the step the first time it is hit.
export async function publishFunnelForStep(db: PrismaClient, slug: string): Promise<boolean> {
  const page = await db.page.findFirst({ where: { slug }, select: { id: true } });
  const funnels = await db.funnel.findMany({ select: { id: true, steps: true }, orderBy: { updatedAt: 'desc' } });
  const owner = funnels.find((f) => {
    const steps = Array.isArray(f.steps) ? (f.steps as Steps) : [];
    return steps.some((s) => s?.stepSlug === slug || (page && s?.pageId === page.id));
  });
  if (!owner) return false;
  return (await makeService(db).publish({ id: owner.id, steps: owner.steps as Steps })) !== null;
}
