import type { PageType } from '../domain/page';

export type PageStatus = 'DRAFT' | 'PUBLISHED';
export type PageEditorType = 'PUCK' | 'HTML' | 'GRAPESJS';

export interface PageDashboardRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  editorType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PageDetailRow extends PageDashboardRow {
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
}

export interface PageFunnelBinding {
  pageId: string;
  funnelId: string;
  funnelName: string;
}

export interface PageListQuery {
  search?: string;
  type?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

export interface PageListResult {
  items: PageDashboardRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  bindings: PageFunnelBinding[];
}

export interface CreatePageInput {
  name: string;
  slug: string;
  type: PageType;
  editorType?: PageEditorType;
  templateName?: string;
  draftData?: unknown;
  publishedData?: unknown;
  status?: PageStatus;
  meta?: unknown;
}

export interface CopyPageInput {
  sourcePageId: string;
  name?: string;
  slug?: string;
  targetPageId?: string;
}

export interface UpdatePageInput {
  name?: string;
  slug?: string;
  status?: PageStatus;
  draftData?: unknown;
  publishedData?: unknown;
  htmlContent?: string;
  draftHtml?: string;
  draftSettings?: unknown;
  settings?: unknown;
  meta?: unknown;
  planContent?: unknown;
}

export interface PageDashboardRepositoryPort {
  list(query: PageListQuery): Promise<{ items: PageDashboardRow[]; total: number }>;
  funnelBindings(pageIds: string[]): Promise<PageFunnelBinding[]>;
  findDetail(pageId: string): Promise<PageDetailRow | null>;
  findBySlug(slug: string): Promise<PageDetailRow | null>;
  create(input: CreatePageInput): Promise<PageDetailRow>;
  update(pageId: string, input: UpdatePageInput): Promise<PageDetailRow>;
  copyToNew(source: PageDetailRow, name: string, slug: string): Promise<PageDetailRow>;
  copyOnto(source: PageDetailRow, targetPageId: string): Promise<PageDetailRow | null>;
  delete(pageId: string): Promise<boolean>;
  invalidateCache(pageId: string, slug: string): Promise<void>;
}

export class PageDashboardError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const PAGE_TYPES: PageType[] = ['checkout', 'thankyou', 'upsell', 'error', 'custom'];
const EDITOR_TYPES: PageEditorType[] = ['PUCK', 'HTML', 'GRAPESJS'];

export class PageDashboardService {
  constructor(private readonly deps: { pages: PageDashboardRepositoryPort }) {}

  async list(query: PageListQuery): Promise<PageListResult> {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.perPage ?? 20));
    const { items, total } = await this.deps.pages.list({ ...query, page, perPage });
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const bindings = items.length ? await this.deps.pages.funnelBindings(items.map((p) => p.id)) : [];
    return { items, total, page, perPage, totalPages, bindings };
  }

  async get(pageId: string): Promise<PageDetailRow> {
    const row = await this.deps.pages.findDetail(pageId);
    if (!row) throw new PageDashboardError(404, 'Page not found');
    return row;
  }

  async create(input: CreatePageInput): Promise<PageDetailRow> {
    const name = input.name?.trim();
    const slug = input.slug?.trim();
    if (!name) throw new PageDashboardError(400, 'Name is required');
    if (!slug) throw new PageDashboardError(400, 'Slug is required');
    if (!PAGE_TYPES.includes(input.type)) throw new PageDashboardError(400, 'Invalid page type');
    const editorType = input.editorType ?? 'PUCK';
    if (!EDITOR_TYPES.includes(editorType)) throw new PageDashboardError(400, 'Invalid editor type');
    if (await this.deps.pages.findBySlug(slug)) {
      throw new PageDashboardError(400, `Slug "${slug}" already exists`);
    }
    return this.deps.pages.create({
      name,
      slug,
      type: input.type,
      editorType,
      templateName: input.templateName,
      draftData: input.draftData,
      publishedData: input.publishedData,
      status: input.status,
      meta: input.meta,
    });
  }

  async update(pageId: string, input: UpdatePageInput): Promise<PageDetailRow> {
    const existing = await this.deps.pages.findDetail(pageId);
    if (!existing) throw new PageDashboardError(404, 'Page not found');
    if (input.slug !== undefined && input.slug !== existing.slug) {
      const clash = await this.deps.pages.findBySlug(input.slug);
      if (clash && clash.id !== pageId) throw new PageDashboardError(400, 'Slug already exists');
    }
    const updated = await this.deps.pages.update(pageId, input);
    await this.deps.pages.invalidateCache(pageId, updated.slug);
    return updated;
  }

  async copy(input: CopyPageInput): Promise<PageDetailRow> {
    if (!input.sourcePageId) throw new PageDashboardError(400, 'Source page ID is required');
    const source = await this.deps.pages.findDetail(input.sourcePageId);
    if (!source) throw new PageDashboardError(404, 'Source page not found');

    if (input.targetPageId) {
      const updated = await this.deps.pages.copyOnto(source, input.targetPageId);
      if (!updated) throw new PageDashboardError(404, 'Target page not found');
      await this.deps.pages.invalidateCache(updated.id, updated.slug);
      return updated;
    }

    const name = input.name?.trim();
    const slug = input.slug?.trim();
    if (!name || !slug) throw new PageDashboardError(400, 'Name and slug are required');
    if (await this.deps.pages.findBySlug(slug)) {
      throw new PageDashboardError(400, `Slug "${slug}" already exists`);
    }
    return this.deps.pages.copyToNew(source, name, slug);
  }

  async delete(pageId: string): Promise<void> {
    const existing = await this.deps.pages.findDetail(pageId);
    if (!existing) throw new PageDashboardError(404, 'Page not found');
    await this.deps.pages.delete(pageId);
    await this.deps.pages.invalidateCache(pageId, existing.slug);
  }
}
