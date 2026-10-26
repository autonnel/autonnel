import { describe, it, expect, vi } from 'vitest';

const renderOptions: unknown[] = [];
vi.mock('@/lib/puck-ssr', () => ({
  renderPuckToHtmlWithIslands: (doc: unknown, _order?: unknown, options?: unknown) => {
    renderOptions.push(options);
    return `<html>${JSON.stringify(doc)}</html>`;
  },
}));

import { PrismaPublicationReader } from './prisma-publication-reader';

const funnelRows = [
  {
    funnelId: 'fn_old',
    version: 1,
    entryStepSlug: 'checkout',
    pinnedPages: [{ stepSlug: 'checkout', pageId: 'pg_old', pagePublicationVersion: 1 }],
    createdAt: new Date('2026-01-01'),
  },
  {
    funnelId: 'fn_new',
    version: 3,
    entryStepSlug: 'lp',
    pinnedPages: [
      { stepSlug: 'lp', pageId: 'pg_lp', pagePublicationVersion: 2 },
      { stepSlug: 'checkout', pageId: 'pg_co', pagePublicationVersion: 5 },
    ],
    createdAt: new Date('2026-02-01'),
  },
];

function fakePrisma(rows: any[] = funnelRows, liveFunnelIds?: string[], livePages: Record<string, unknown> = {}) {
  const pages: Record<string, { document: unknown }> = {
    'pg_lp:2': { document: { content: ['lp'] } },
    'pg_co:5': { document: { content: ['co'] } },
    'pg_old:1': { document: { content: ['old'] } },
  };
  return {
    funnel: {
      findMany: vi.fn(async ({ where }: any) =>
        (where.id.in as string[]).filter((id) => !liveFunnelIds || liveFunnelIds.includes(id)).map((id) => ({ id })),
      ),
    },
    funnelPublication: {
      findMany: vi.fn(async ({ orderBy }: any) => {
        const sorted = [...rows].sort((a, b) =>
          orderBy?.createdAt === 'desc' ? b.createdAt.getTime() - a.createdAt.getTime() : 0,
        );
        return sorted;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const { funnelId, version } = where.tenantId_funnelId_version;
        return rows.find((r) => r.funnelId === funnelId && r.version === version) ?? null;
      }),
    },
    page: {
      findMany: vi.fn(async ({ where }: any) =>
        (where.id.in as string[]).filter((id) => id in livePages).map((id) => ({ id, publishedData: livePages[id] })),
      ),
    },
    pagePublication: {
      findUnique: vi.fn(async ({ where }: any) => {
        const { pageId, version } = where.tenantId_pageId_version;
        return pages[`${pageId}:${version}`] ?? null;
      }),
    },
  } as any;
}

describe('PrismaPublicationReader', () => {
  it('resolveByStepSlug picks the most recent publication containing the step (pinned match)', async () => {
    const reader = new PrismaPublicationReader(fakePrisma());
    const snap = await reader.resolveByStepSlug('checkout');
    expect(snap?.funnelId).toBe('fn_new');
    expect(snap?.version).toBe(3);
    expect(snap?.stepSlugs).toEqual(['lp', 'checkout']);
    expect(snap?.entryStep).toBe('lp');
  });

  it('resolveByStepSlug matches on entryStepSlug', async () => {
    const reader = new PrismaPublicationReader(fakePrisma());
    const snap = await reader.resolveByStepSlug('lp');
    expect(snap?.funnelId).toBe('fn_new');
  });

  it('resolveByStepSlug renders each pinned pages document to HTML', async () => {
    const reader = new PrismaPublicationReader(fakePrisma());
    const snap = await reader.resolveByStepSlug('lp');
    expect(snap?.pageHtmlByStep.lp).toContain('lp');
    expect(snap?.pageHtmlByStep.checkout).toContain('co');
  });

  it('renders pinned pages without live pricing because the step route never hydrates islands', async () => {
    renderOptions.length = 0;
    await new PrismaPublicationReader(fakePrisma()).resolveByStepSlug('lp');
    expect(renderOptions.length).toBeGreaterThan(0);
    for (const o of renderOptions) expect(o).toEqual({ livePricing: false });
  });

  it('resolveByStepSlug returns null when no publication matches', async () => {
    const reader = new PrismaPublicationReader(fakePrisma());
    expect(await reader.resolveByStepSlug('missing')).toBeNull();
  });

  it('resolvePinned looks up by funnelId + version', async () => {
    const reader = new PrismaPublicationReader(fakePrisma());
    const snap = await reader.resolvePinned('fn_old', 1);
    expect(snap?.funnelId).toBe('fn_old');
    expect(snap?.entryStep).toBe('checkout');
    expect(snap?.pageHtmlByStep.checkout).toContain('old');
  });

  it('resolvePinned returns null for an unknown funnel/version', async () => {
    const reader = new PrismaPublicationReader(fakePrisma());
    expect(await reader.resolvePinned('fn_old', 99)).toBeNull();
  });

  it('skips pages with no published document without throwing', async () => {
    const rows = [
      {
        funnelId: 'fn_x',
        version: 1,
        entryStepSlug: 'checkout',
        pinnedPages: [{ stepSlug: 'checkout', pageId: 'pg_missing', pagePublicationVersion: 9 }],
        createdAt: new Date('2026-03-01'),
      },
    ];
    const reader = new PrismaPublicationReader(fakePrisma(rows));
    const snap = await reader.resolveByStepSlug('checkout');
    expect(snap?.stepSlugs).toEqual(['checkout']);
    expect(snap?.pageHtmlByStep).toEqual({});
    expect(snap?.pageCurrencyByStep).toEqual({});
  });

  it('ignores older versions that still list a step the newest version removed', async () => {
    const rows = [
      { funnelId: 'fn', version: 1, entryStepSlug: 'lp', pinnedPages: [{ stepSlug: 'lp', pageId: 'a', pagePublicationVersion: 0 }, { stepSlug: 'gone', pageId: 'b', pagePublicationVersion: 0 }], createdAt: new Date('2026-01-01') },
      { funnelId: 'fn', version: 2, entryStepSlug: 'lp', pinnedPages: [{ stepSlug: 'lp', pageId: 'a', pagePublicationVersion: 0 }], createdAt: new Date('2026-01-02') },
    ];
    const reader = new PrismaPublicationReader(fakePrisma(rows));
    expect(await reader.resolveByStepSlug('gone')).toBeNull();
    expect((await reader.resolveByStepSlug('lp'))?.version).toBe(2);
  });

  it('skips publications of deleted funnels', async () => {
    const reader = new PrismaPublicationReader(fakePrisma(funnelRows, ['fn_old']));
    expect((await reader.resolveByStepSlug('checkout'))?.funnelId).toBe('fn_old');
  });

  it('matches the page slug the storefront sends and keeps it in the session steps', async () => {
    const rows = [
      { funnelId: 'fn', version: 1, entryStepSlug: 'landing', pinnedPages: [{ stepSlug: 'landing', pageId: 'a', pageSlug: 'spring-lp', pagePublicationVersion: 0 }, { stepSlug: 'pay', pageId: 'b', pageSlug: 'spring-checkout', pagePublicationVersion: 0 }], createdAt: new Date() },
    ];
    const prisma = fakePrisma(rows);
    const snap = await new PrismaPublicationReader(prisma).resolveByStepSlug('spring-checkout');
    expect(snap?.stepSlugs).toEqual(['landing', 'spring-lp', 'pay', 'spring-checkout']);
    expect(prisma.pagePublication.findUnique).not.toHaveBeenCalled();
  });

  it('publishes the live funnel on a miss and resolves the new snapshot', async () => {
    const rows: any[] = [];
    const publishMissing = vi.fn(async (slug: string) => {
      rows.push({ funnelId: 'fn', version: 1, entryStepSlug: slug, pinnedPages: [{ stepSlug: slug, pageId: 'a', pagePublicationVersion: 0 }], createdAt: new Date() });
      return true;
    });
    const snap = await new PrismaPublicationReader(fakePrisma(rows), publishMissing).resolveByStepSlug('co');
    expect(publishMissing).toHaveBeenCalledWith('co');
    expect(snap?.stepSlugs).toEqual(['co']);
  });

  it('returns null when the miss handler finds no funnel', async () => {
    const reader = new PrismaPublicationReader(fakePrisma([]), async () => false);
    expect(await reader.resolveByStepSlug('nope')).toBeNull();
  });

  it('reads each pinned page currency from its document root props, keyed by step and page slug', async () => {
    const rows = [
      { funnelId: 'fn', version: 1, entryStepSlug: 'lp', pinnedPages: [
        { stepSlug: 'lp', pageId: 'pg_lp', pagePublicationVersion: 2 },
        { stepSlug: 'checkout', pageId: 'pg_co', pageSlug: 'spring-checkout', pagePublicationVersion: 5 },
        { stepSlug: 'upsell', pageId: 'pg_none', pagePublicationVersion: 0 },
      ], createdAt: new Date() },
    ];
    const prisma = fakePrisma(rows);
    prisma.pagePublication.findUnique.mockImplementation(async ({ where }: any) => {
      const { pageId } = where.tenantId_pageId_version;
      if (pageId === 'pg_lp') return { document: { root: { props: { currency: '' } }, content: [] } };
      if (pageId === 'pg_co') return { document: { root: { props: { currency: 'EUR' } }, content: [] } };
      return null;
    });
    const snap = await new PrismaPublicationReader(prisma).resolveByStepSlug('lp');
    expect(snap?.pageCurrencyByStep).toEqual({ lp: '', checkout: 'EUR', 'spring-checkout': 'EUR' });
    expect(prisma.pagePublication.findUnique).toHaveBeenCalledTimes(2);
  });

  it('reads the currency of pages pinned live (version 0) from their published page', async () => {
    const rows = [
      { funnelId: 'fn', version: 1, entryStepSlug: 'lp', pinnedPages: [
        { stepSlug: 'lp', pageId: 'pg_lp', pageSlug: 'spring-lp', pagePublicationVersion: 0 },
        { stepSlug: 'checkout', pageId: 'pg_co', pageSlug: 'spring-checkout', pagePublicationVersion: 0 },
        { stepSlug: 'draft', pageId: 'pg_unpublished', pagePublicationVersion: 0 },
      ], createdAt: new Date() },
    ];
    const prisma = fakePrisma(rows, undefined, {
      pg_lp: { root: { props: {} }, content: [] },
      pg_co: { root: { props: { currency: 'EUR' } }, content: [] },
      pg_unpublished: null,
    });
    const snap = await new PrismaPublicationReader(prisma).resolveByStepSlug('spring-checkout');
    expect(snap?.pageCurrencyByStep).toEqual({ lp: '', 'spring-lp': '', checkout: 'EUR', 'spring-checkout': 'EUR', draft: '' });
    expect(snap?.pageHtmlByStep).toEqual({});
    expect(prisma.page.findMany).toHaveBeenCalledTimes(1);
  });
});
