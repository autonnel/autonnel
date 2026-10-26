import { describe, it, expect } from 'vitest';
import { PrismaPageDashboardRepository } from './page-dashboard-repository';

interface Row {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  editorType: string;
  createdAt: Date;
  updatedAt: Date;
  templateName: string | null;
  draftData: unknown;
  publishedData: unknown;
  htmlContent: string | null;
  draftHtml: string | null;
  draftSettings: unknown;
  settings: unknown;
  meta: unknown;
  planContent: unknown;
  publishedAt: Date | null;
  publishState?: string | null;
}

function row(over: Partial<Row> = {}): Row {
  const now = new Date('2026-01-01T00:00:00Z');
  return {
    id: 'p1',
    name: 'Home',
    slug: 'home',
    type: 'CUSTOM',
    status: 'PUBLISHED',
    editorType: 'PUCK',
    createdAt: now,
    updatedAt: now,
    templateName: null,
    draftData: null,
    publishedData: null,
    htmlContent: null,
    draftHtml: null,
    draftSettings: null,
    settings: null,
    meta: null,
    planContent: null,
    publishedAt: now,
    ...over,
  };
}

function makeRepo(initial: Row) {
  const store = new Map<string, Row>([[initial.id, { ...initial }]]);
  const db = {
    page: {
      findFirst: async ({ where }: { where: { id?: string; slug?: string } }) => {
        for (const r of store.values()) {
          if (where.id && r.id === where.id) return r;
          if (where.slug && r.slug === where.slug) return r;
        }
        return null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const current = store.get(where.id)!;
        const next = { ...current, ...data } as Row;
        store.set(where.id, next);
        return next;
      },
    },
  };
  const repo = new PrismaPageDashboardRepository(db as never, 'default', async () => {});
  return { repo, store };
}

describe('PrismaPageDashboardRepository.update publish promotion', () => {
  it('promotes new draftData to publishedData when content and publish arrive in one call', async () => {
    const { repo } = makeRepo(
      row({ draftData: { root: {}, content: ['old'] }, publishedData: { root: {}, content: ['old'] } }),
    );
    const next = { root: {}, content: ['new'] };

    const updated = await repo.update('p1', { draftData: next, status: 'PUBLISHED' });

    expect(updated.draftData).toEqual(next);
    expect(updated.publishedData).toEqual(next);
  });

  it('keeps the new htmlContent when an HTML page is published in one call', async () => {
    const { repo } = makeRepo(
      row({ editorType: 'HTML', htmlContent: '<p>old</p>', draftHtml: '<p>old</p>' }),
    );

    const updated = await repo.update('p1', { htmlContent: '<p>new</p>', status: 'PUBLISHED' });

    expect(updated.htmlContent).toBe('<p>new</p>');
    expect(updated.draftHtml).toBe('<p>new</p>');
  });

  it('still promotes the stored draft when publishing without content', async () => {
    const { repo } = makeRepo(row({ draftData: { content: ['draft'] }, publishedData: { content: ['live'] } }));

    const updated = await repo.update('p1', { status: 'PUBLISHED' });

    expect(updated.publishedData).toEqual({ content: ['draft'] });
  });

  it('still promotes the stored draftHtml when publishing an HTML page without content', async () => {
    const { repo } = makeRepo(row({ editorType: 'HTML', htmlContent: '<p>live</p>', draftHtml: '<p>draft</p>' }));

    const updated = await repo.update('p1', { status: 'PUBLISHED' });

    expect(updated.htmlContent).toBe('<p>draft</p>');
  });

  it('survives the two-call flow: write htmlContent, then publish', async () => {
    const { repo } = makeRepo(
      row({ editorType: 'HTML', htmlContent: '<p>old</p>', draftHtml: '<p>old</p>' }),
    );

    await repo.update('p1', { htmlContent: '<p>new</p>' });
    const published = await repo.update('p1', { status: 'PUBLISHED' });

    expect(published.htmlContent).toBe('<p>new</p>');
  });

  it('promotes a GRAPESJS page draft on publish', async () => {
    const { repo } = makeRepo(
      row({ editorType: 'GRAPESJS', htmlContent: '<p>live</p>', draftHtml: '<p>draft</p>' }),
    );

    const updated = await repo.update('p1', { status: 'PUBLISHED' });

    expect(updated.htmlContent).toBe('<p>draft</p>');
  });

  it('syncs draftData when only publishedData is written', async () => {
    const { repo } = makeRepo(row({ draftData: { content: ['old'] }, publishedData: { content: ['old'] } }));

    const updated = await repo.update('p1', { publishedData: { content: ['new'] }, status: 'PUBLISHED' });

    expect(updated.publishedData).toEqual({ content: ['new'] });
    expect(updated.draftData).toEqual({ content: ['new'] });
  });

  it('does not touch content columns when only metadata changes', async () => {
    const { repo } = makeRepo(row({ draftData: { content: ['x'] }, publishedData: { content: ['y'] } }));

    const updated = await repo.update('p1', { name: 'Renamed' });

    expect(updated.name).toBe('Renamed');
    expect(updated.draftData).toEqual({ content: ['x'] });
    expect(updated.publishedData).toEqual({ content: ['y'] });
  });
});
