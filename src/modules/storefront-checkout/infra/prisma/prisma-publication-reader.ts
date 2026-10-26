import type { PrismaClient } from '@prisma/client';
import type { FunnelStepSnapshot } from '../../application/ports/outbound';
import type { PublicationReadPort } from '../clients/funnel-snapshot-client';

interface PinnedPageRow {
  stepSlug: string;
  pageId: string;
  pageSlug?: string;
  pagePublicationVersion: number;
}

interface LoadedPage {
  stepSlug: string;
  pageSlug?: string;
  document: unknown;
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
// The /n step route serving this HTML never hydrates islands, so prices render as stored.
type PuckRenderer = (document: unknown) => string;

async function loadPuckRenderer(): Promise<PuckRenderer> {
  const mod = await import('@/lib/puck-ssr');
  return (document: unknown) => mod.renderPuckToHtmlWithIslands(document as never, undefined, { livePricing: false });
}

export class PrismaPublicationReader implements PublicationReadPort {
  // publishMissing publishes the live funnel owning a step that has no snapshot yet; returns whether it did.
  constructor(
    private readonly prisma: PrismaClient,
    private readonly publishMissing?: (stepSlug: string) => Promise<boolean>,
  ) {}

  async resolveByStepSlug(stepSlug: string): Promise<FunnelStepSnapshot | null> {
    const match = await this.findCurrent(stepSlug);
    if (match) return this.assemble(match);
    if (!this.publishMissing || !(await this.publishMissing(stepSlug))) return null;
    const published = await this.findCurrent(stepSlug);
    return published ? this.assemble(published) : null;
  }

  // Only each live funnel's newest version counts: older versions still list removed steps.
  private async findCurrent(stepSlug: string): Promise<FunnelPublicationRow | null> {
    const rows = (await this.prisma.funnelPublication.findMany({
      orderBy: { createdAt: 'desc' },
    })) as unknown as FunnelPublicationRow[];
    const latest = new Map<string, FunnelPublicationRow>();
    for (const r of rows) {
      const seen = latest.get(r.funnelId);
      if (!seen || r.version > seen.version) latest.set(r.funnelId, r);
    }
    const candidates = rows.filter(
      (r) =>
        latest.get(r.funnelId) === r &&
        (r.entryStepSlug === stepSlug ||
          normalizePinned(r.pinnedPages).some((p) => p.stepSlug === stepSlug || p.pageSlug === stepSlug)),
    );
    if (candidates.length === 0) return null;
    const live = await this.prisma.funnel.findMany({
      where: { id: { in: candidates.map((c) => c.funnelId) } },
      select: { id: true },
    });
    const liveIds = new Set(live.map((f) => f.id));
    return candidates.find((c) => liveIds.has(c.funnelId)) ?? null;
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
    const pages = await this.loadPages(pinned);
    return {
      funnelId: row.funnelId,
      version: row.version,
      stepSlugs: [...new Set(pinned.flatMap((p) => (p.pageSlug ? [p.stepSlug, p.pageSlug] : [p.stepSlug])))],
      entryStep: row.entryStepSlug,
      pageHtmlByStep: await this.renderPages(pages),
      pageCurrencyByStep: { ...pageCurrencies(await this.loadLivePages(pinned)), ...pageCurrencies(pages) },
    };
  }

  // Pages pinned at version 0 are served live from `pages`, so their published document is the source.
  private async loadLivePages(pinned: PinnedPageRow[]): Promise<LoadedPage[]> {
    const live = pinned.filter((p) => !(p.pagePublicationVersion > 0));
    if (live.length === 0) return [];
    const rows = (await this.prisma.page.findMany({
      where: { id: { in: [...new Set(live.map((p) => p.pageId))] } },
      select: { id: true, publishedData: true },
    })) as { id: string; publishedData: unknown }[];
    const documents = new Map(rows.map((r) => [r.id, r.publishedData]));
    return live
      .filter((p) => documents.has(p.pageId))
      .map((p) => ({ stepSlug: p.stepSlug, pageSlug: p.pageSlug, document: documents.get(p.pageId) }));
  }

  private async loadPages(pinned: PinnedPageRow[]): Promise<LoadedPage[]> {
    if (pinned.length === 0) return [];
    const docs = await Promise.all(pinned.map((p) => this.loadDocument(p)));
    return docs.filter((d): d is LoadedPage => d !== null);
  }

  private async renderPages(pages: LoadedPage[]): Promise<Record<string, string>> {
    if (pages.length === 0) return {};
    const render = await loadPuckRenderer();
    const out: Record<string, string> = {};
    for (const { stepSlug, document } of pages) {
      out[stepSlug] = render(document);
    }
    return out;
  }

  private async loadDocument(p: PinnedPageRow): Promise<LoadedPage | null> {
    if (!(p.pagePublicationVersion > 0)) return null;
    const page = (await this.prisma.pagePublication.findUnique({
      where: { tenantId_pageId_version: { pageId: p.pageId, version: p.pagePublicationVersion } } as never,
      select: { document: true },
    })) as { document: unknown } | null;
    if (!page) return null;
    return { stepSlug: p.stepSlug, pageSlug: p.pageSlug, document: page.document };
  }
}

function normalizePinned(value: unknown): PinnedPageRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (p): p is PinnedPageRow =>
      !!p && typeof (p as PinnedPageRow).stepSlug === 'string' && typeof (p as PinnedPageRow).pageId === 'string',
  );
}

function pageCurrencies(pages: LoadedPage[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { stepSlug, pageSlug, document } of pages) {
    const currency = (document as { root?: { props?: { currency?: unknown } } } | null)?.root?.props?.currency;
    const value = typeof currency === 'string' ? currency : '';
    out[stepSlug] = value;
    if (pageSlug) out[pageSlug] = value;
  }
  return out;
}
