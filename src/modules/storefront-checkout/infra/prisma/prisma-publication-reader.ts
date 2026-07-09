import type { PrismaClient } from '@prisma/client';
import type { FunnelStepSnapshot } from '../../application/ports/outbound';
import type { PublicationReadPort } from '../clients/funnel-snapshot-client';

interface PinnedPageRow {
  stepSlug: string;
  pageId: string;
  pagePublicationVersion: number;
}

interface FunnelPublicationRow {
  funnelId: string;
  version: number;
  entryStepSlug: string;
  pinnedPages: PinnedPageRow[];
  createdAt: Date;
}

// Renders a pinned page's published Puck document to static HTML. Lazily imported so the
// Puck/React config never loads on the checkout-API hot path (only the page-render path needs it).
type PuckRenderer = (document: unknown) => string;

async function loadPuckRenderer(): Promise<PuckRenderer> {
  const mod = await import('@/lib/puck-ssr');
  return (document: unknown) => mod.renderPuckToHtmlWithIslands(document as never);
}

export class PrismaPublicationReader implements PublicationReadPort {
  constructor(private readonly prisma: PrismaClient) {}

  async resolveByStepSlug(stepSlug: string): Promise<FunnelStepSnapshot | null> {
    const rows = (await this.prisma.funnelPublication.findMany({
      orderBy: { createdAt: 'desc' },
    })) as unknown as FunnelPublicationRow[];

    const match = rows.find(
      (r) =>
        r.entryStepSlug === stepSlug ||
        normalizePinned(r.pinnedPages).some((p) => p.stepSlug === stepSlug),
    );
    if (!match) return null;
    return this.assemble(match);
  }

  async resolvePinned(funnelId: string, version: number): Promise<FunnelStepSnapshot | null> {
    const row = (await this.prisma.funnelPublication.findUnique({
      where: { tenantId_funnelId_version: { funnelId, version } } as never,
    })) as unknown as FunnelPublicationRow | null;
    if (!row) return null;
    return this.assemble(row);
  }

  private async assemble(row: FunnelPublicationRow): Promise<FunnelStepSnapshot> {
    const pinned = normalizePinned(row.pinnedPages);
    return {
      funnelId: row.funnelId,
      version: row.version,
      stepSlugs: pinned.map((p) => p.stepSlug),
      entryStep: row.entryStepSlug,
      pageHtmlByStep: await this.renderPages(pinned),
    };
  }

  private async renderPages(pinned: PinnedPageRow[]): Promise<Record<string, string>> {
    if (pinned.length === 0) return {};
    const docs = await Promise.all(pinned.map((p) => this.loadDocument(p)));
    const renderable = docs.filter((d): d is { stepSlug: string; document: unknown } => d !== null);
    if (renderable.length === 0) return {};

    const render = await loadPuckRenderer();
    const out: Record<string, string> = {};
    for (const { stepSlug, document } of renderable) {
      out[stepSlug] = render(document);
    }
    return out;
  }

  private async loadDocument(
    p: PinnedPageRow,
  ): Promise<{ stepSlug: string; document: unknown } | null> {
    const page = (await this.prisma.pagePublication.findUnique({
      where: { tenantId_pageId_version: { pageId: p.pageId, version: p.pagePublicationVersion } } as never,
      select: { document: true },
    })) as { document: unknown } | null;
    if (!page) return null;
    return { stepSlug: p.stepSlug, document: page.document };
  }
}

function normalizePinned(value: unknown): PinnedPageRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (p): p is PinnedPageRow =>
      !!p && typeof (p as PinnedPageRow).stepSlug === 'string' && typeof (p as PinnedPageRow).pageId === 'string',
  );
}
