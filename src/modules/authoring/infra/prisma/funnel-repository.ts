import type { PrismaClient } from '@prisma/client';
import type { FunnelRepositoryPort } from '../../application/ports';
import { Funnel } from '../../domain/funnel';
import type { PublishState } from '../../domain/value-objects/publish-state';
import type { Transition } from '../../domain/value-objects/routing-rule';
import type { PinnedPage } from '../../domain/services/publication-assembler';
import { invalidateFunnelContextForPages } from '@/lib/adapters/cache';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FunnelRepository');

interface Step {
  stepSlug: string;
  pageId: string;
}

interface FunnelRow {
  id: string;
  name: string;
  steps: unknown;
  transitions: unknown;
  publishState: string;
  publishedPinnedPages: unknown;
  publishedVersion: number | null;
}

export class PrismaFunnelRepository implements FunnelRepositoryPort {
  constructor(private readonly db: PrismaClient) {}

  async load(funnelId: string): Promise<Funnel | null> {
    const row = (await this.db.funnel.findUnique({ where: { id: funnelId } })) as FunnelRow | null;
    if (!row) return null;
    return Funnel.rehydrate({
      id: row.id,
      name: row.name,
      steps: ((row.steps as Step[]) ?? []),
      transitions: ((row.transitions as Transition[]) ?? []),
      publishState: row.publishState as PublishState,
      publishedPinnedPages: ((row.publishedPinnedPages as PinnedPage[]) ?? []),
      publishedVersion: row.publishedVersion,
    });
  }

  async save(funnel: Funnel): Promise<void> {
    const data = {
      steps: [...funnel.steps] as never,
      transitions: [...funnel.transitions] as never,
      publishState: funnel.publishState,
      publishedPinnedPages: funnel.publishedPinnedPages as never,
    };
    // tenantId is auto-injected by the Prisma tenant extension; the static type still
    // requires it, hence the cast at this write seam.
    await this.db.funnel.upsert({
      where: { id: funnel.id },
      create: { id: funnel.id, name: '', ...data } as never,
      update: data,
    });

    // A step change alters the resolved "next step" of OTHER steps too (e.g. adding an upsell
    // changes checkout's next), so drop the cached funnel context for every page in the funnel —
    // otherwise the 12h-TTL cache keeps routing payment straight to thank-you.
    try {
      const pageIds = funnel.steps.map((s) => s.pageId).filter((id): id is string => !!id);
      if (pageIds.length) await invalidateFunnelContextForPages(getCurrentTenantId(), pageIds);
    } catch (error) {
      logger.warn('Failed to invalidate funnel context cache after save', { error, funnelId: funnel.id });
    }
  }

  async lastPublishedVersion(funnelId: string): Promise<number | null> {
    const row = await this.db.funnelPublication.findFirst({
      where: { funnelId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return row?.version ?? null;
  }
}
