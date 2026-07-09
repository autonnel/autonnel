import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/puck-ssr', () => ({
  renderPuckToHtmlWithIslands: (doc: unknown) => `<html>${JSON.stringify(doc)}</html>`,
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

function fakePrisma(rows = funnelRows) {
  const pages: Record<string, { document: unknown }> = {
    'pg_lp:2': { document: { content: ['lp'] } },
    'pg_co:5': { document: { content: ['co'] } },
    'pg_old:1': { document: { content: ['old'] } },
  };
  return {
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
  });
});
