import { describe, it, expect, beforeEach } from 'vitest';
import {
  PageDashboardService,
  PageDashboardError,
  type PageDashboardRepositoryPort,
  type PageDetailRow,
  type PageDashboardRow,
  type PageListQuery,
  type CreatePageInput,
  type UpdatePageInput,
  type PageFunnelBinding,
} from './page-dashboard-service';

function detail(over: Partial<PageDetailRow> = {}): PageDetailRow {
  const now = new Date();
  return {
    id: 'p1',
    name: 'Home',
    slug: 'home',
    type: 'CUSTOM',
    status: 'DRAFT',
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
    publishedAt: null,
    ...over,
  };
}

class FakeRepo implements PageDashboardRepositoryPort {
  rows = new Map<string, PageDetailRow>();
  bindings: PageFunnelBinding[] = [];
  invalidated: Array<{ pageId: string; slug: string }> = [];

  async list(query: PageListQuery): Promise<{ items: PageDashboardRow[]; total: number }> {
    let items = [...this.rows.values()];
    if (query.search) items = items.filter((r) => r.name.includes(query.search!) || r.slug.includes(query.search!));
    return { items: items as PageDashboardRow[], total: items.length };
  }
  async funnelBindings(): Promise<PageFunnelBinding[]> {
    return this.bindings;
  }
  async findDetail(id: string): Promise<PageDetailRow | null> {
    return this.rows.get(id) ?? null;
  }
  async findBySlug(slug: string): Promise<PageDetailRow | null> {
    return [...this.rows.values()].find((r) => r.slug === slug) ?? null;
  }
  async create(input: CreatePageInput): Promise<PageDetailRow> {
    const row = detail({ id: `new-${input.slug}`, name: input.name, slug: input.slug, type: input.type, editorType: input.editorType });
    this.rows.set(row.id, row);
    return row;
  }
  async update(pageId: string, input: UpdatePageInput): Promise<PageDetailRow> {
    const existing = this.rows.get(pageId);
    if (!existing) throw new Error('not found');
    const merged = detail({ ...existing, ...(input.name !== undefined ? { name: input.name } : {}), ...(input.slug !== undefined ? { slug: input.slug } : {}), ...(input.status !== undefined ? { status: input.status } : {}) });
    this.rows.set(pageId, merged);
    return merged;
  }
  async copyToNew(source: PageDetailRow, name: string, slug: string): Promise<PageDetailRow> {
    const row = detail({ id: `copy-${slug}`, name, slug, type: source.type, editorType: source.editorType });
    this.rows.set(row.id, row);
    return row;
  }
  async copyOnto(source: PageDetailRow, targetPageId: string): Promise<PageDetailRow | null> {
    const t = this.rows.get(targetPageId);
    if (!t) return null;
    const merged = detail({ ...t, editorType: source.editorType });
    this.rows.set(targetPageId, merged);
    return merged;
  }
  async delete(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }
  async invalidateCache(pageId: string, slug: string): Promise<void> {
    this.invalidated.push({ pageId, slug });
  }
}

describe('PageDashboardService', () => {
  let repo: FakeRepo;
  let svc: PageDashboardService;
  beforeEach(() => {
    repo = new FakeRepo();
    svc = new PageDashboardService({ pages: repo });
  });

  it('lists with pagination metadata and bindings', async () => {
    repo.rows.set('p1', detail({ id: 'p1', slug: 'a' }));
    repo.rows.set('p2', detail({ id: 'p2', slug: 'b' }));
    repo.bindings = [{ pageId: 'p1', funnelId: 'f1', funnelName: 'Main' }];
    const res = await svc.list({ page: 1, perPage: 20 });
    expect(res.total).toBe(2);
    expect(res.totalPages).toBe(1);
    expect(res.bindings).toHaveLength(1);
  });

  it('rejects create with missing fields', async () => {
    await expect(svc.create({ name: '', slug: 's', type: 'custom' })).rejects.toBeInstanceOf(PageDashboardError);
    await expect(svc.create({ name: 'n', slug: '', type: 'custom' })).rejects.toBeInstanceOf(PageDashboardError);
  });

  it('rejects create on duplicate slug', async () => {
    repo.rows.set('p1', detail({ slug: 'dup' }));
    await expect(svc.create({ name: 'n', slug: 'dup', type: 'custom' })).rejects.toMatchObject({ status: 400 });
  });

  it('creates a page', async () => {
    const row = await svc.create({ name: 'New', slug: 'new', type: 'checkout', editorType: 'HTML' });
    expect(row.name).toBe('New');
    expect(row.editorType).toBe('HTML');
  });

  it('updates a page and invalidates cache', async () => {
    repo.rows.set('p1', detail({ id: 'p1', slug: 'home' }));
    const row = await svc.update('p1', { name: 'Renamed', status: 'PUBLISHED' });
    expect(row.name).toBe('Renamed');
    expect(row.status).toBe('PUBLISHED');
    expect(repo.invalidated).toEqual([{ pageId: 'p1', slug: 'home' }]);
  });

  it('rejects update with a slug already taken by another page', async () => {
    repo.rows.set('p1', detail({ id: 'p1', slug: 'home' }));
    repo.rows.set('p2', detail({ id: 'p2', slug: 'taken' }));
    await expect(svc.update('p1', { slug: 'taken' })).rejects.toMatchObject({ status: 400 });
  });

  it('404s update when missing', async () => {
    await expect(svc.update('nope', { name: 'x' })).rejects.toMatchObject({ status: 404 });
  });

  it('copies to a new page', async () => {
    repo.rows.set('src', detail({ id: 'src', slug: 'src' }));
    const row = await svc.copy({ sourcePageId: 'src', name: 'Clone', slug: 'clone' });
    expect(row.slug).toBe('clone');
  });

  it('copies onto an existing target and invalidates cache', async () => {
    repo.rows.set('src', detail({ id: 'src', slug: 'src', editorType: 'GRAPESJS' }));
    repo.rows.set('tgt', detail({ id: 'tgt', slug: 'tgt' }));
    const row = await svc.copy({ sourcePageId: 'src', targetPageId: 'tgt' });
    expect(row.editorType).toBe('GRAPESJS');
    expect(repo.invalidated).toEqual([{ pageId: 'tgt', slug: 'tgt' }]);
  });

  it('404s copy when source missing', async () => {
    await expect(svc.copy({ sourcePageId: 'nope' })).rejects.toMatchObject({ status: 404 });
  });

  it('deletes a page and invalidates cache', async () => {
    repo.rows.set('p1', detail({ id: 'p1', slug: 'home' }));
    await svc.delete('p1');
    expect(repo.rows.has('p1')).toBe(false);
    expect(repo.invalidated).toEqual([{ pageId: 'p1', slug: 'home' }]);
  });

  it('404s delete when missing', async () => {
    await expect(svc.delete('nope')).rejects.toMatchObject({ status: 404 });
  });
});
