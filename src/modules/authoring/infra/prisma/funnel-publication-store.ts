import type { PrismaClient } from '@prisma/client';
import type {
  FunnelPublicationDraft,
  FunnelPublicationStorePort,
  PageSlugPort,
} from '../../application/funnel-publishing-service';

export class PrismaFunnelPublicationStore implements FunnelPublicationStorePort, PageSlugPort {
  constructor(private readonly db: PrismaClient) {}

  async latest(funnelId: string): Promise<{ version: number; contentHash: string } | null> {
    return this.db.funnelPublication.findFirst({
      where: { funnelId },
      orderBy: { version: 'desc' },
      select: { version: true, contentHash: true },
    });
  }

  async create(draft: FunnelPublicationDraft): Promise<boolean> {
    try {
      // tenantId is injected by the Prisma tenant extension.
      await this.db.funnelPublication.create({ data: { ...draft, pinnedPages: draft.pinnedPages as never } as never });
      return true;
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') return false;
      throw error;
    }
  }

  async markPublished(draft: FunnelPublicationDraft): Promise<void> {
    await this.db.funnel.updateMany({
      where: { id: draft.funnelId },
      data: { publishState: 'published', publishedVersion: draft.version, publishedPinnedPages: draft.pinnedPages as never },
    });
  }

  async slugsById(pageIds: string[]): Promise<Map<string, string>> {
    if (pageIds.length === 0) return new Map();
    const rows = await this.db.page.findMany({ where: { id: { in: pageIds } }, select: { id: true, slug: true } });
    return new Map(rows.map((r) => [r.id, r.slug]));
  }
}
