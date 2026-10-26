import { getCurrentTenantId } from '@/lib/tenant/context';
import type { PageEngagementRow, PageEngagementStorePort } from '../../application/ports/outbound';

type EngagementDelegate = {
  upsert: (args: unknown) => Promise<unknown>;
  findUnique: (args: unknown) => Promise<unknown>;
};

/**
 * Keep the longer visit on conflict.
 *
 * The scalars move together with whichever side has the greater dwell, so the
 * arrays and the scalars always describe one consistent visit. Interactions are
 * unioned instead: a later beacon carrying a shorter list did not un-happen
 * anything.
 */
export class PrismaPageEngagementStore implements PageEngagementStorePort {
  constructor(private readonly delegate: EngagementDelegate) {}

  async upsertEngagement(row: PageEngagementRow): Promise<void> {
    // The tenant prisma extension does not inject tenantId into the compound
    // unique's nested object on findUnique/upsert (only into a top-level
    // where on read ops, and not at all on upsert's where), and the compound
    // key type requires tenantId as one of its fields. Supply it explicitly.
    const tenantId = getCurrentTenantId();
    const uniqueKey = {
      tenantId_visitorId_sessionId_pageId: {
        tenantId,
        visitorId: row.visitorId,
        sessionId: row.sessionId,
        pageId: row.pageId,
      },
    };

    const existing = (await this.delegate.findUnique({
      where: uniqueKey,
      select: { dwellMs: true, interactions: true },
    } as never)) as { dwellMs: number; interactions: string[] } | null;

    const interactions = existing
      ? [...new Set([...existing.interactions, ...row.interactions])]
      : row.interactions;

    if (existing && existing.dwellMs > row.dwellMs) {
      await this.delegate.upsert({
        where: uniqueKey,
        create: { ...row, interactions },
        update: { interactions },
      } as never);
      return;
    }

    // The tenant prisma extension injects tenantId into upsert's `create` only,
    // never into `update` - the row is already pinned to this tenant by the
    // explicit tenantId in `where` above, so `update` needs no injection.
    await this.delegate.upsert({
      where: uniqueKey,
      create: { ...row, interactions },
      update: { ...row, interactions },
    } as never);
  }
}
