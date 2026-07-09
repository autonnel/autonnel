import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  PageDashboardRepositoryPort,
  PageDashboardRow,
  PageDetailRow,
  PageFunnelBinding,
  PageListQuery,
  CreatePageInput,
  UpdatePageInput,
} from '../../application/page-dashboard-service';

const PAGE_TYPE_DB: Record<string, string> = {
  checkout: 'CHECKOUT',
  thankyou: 'THANKYOU',
  upsell: 'UPSELL',
  error: 'ERROR',
  custom: 'CUSTOM',
};

interface DetailSelectRow {
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
}

function toDetail(row: DetailSelectRow): PageDetailRow {
  return { ...row };
}

export class PrismaPageDashboardRepository implements PageDashboardRepositoryPort {
  constructor(
    private readonly db: PrismaClient,
    private readonly tenantId: string,
    private readonly invalidate: (tenantId: string, pageId: string, slug: string) => Promise<void>,
  ) {}

  async list(query: PageListQuery): Promise<{ items: PageDashboardRow[]; total: number }> {
    const where: Prisma.PageWhereInput = {};
    if (query.type) where.type = query.type.toUpperCase();
    if (query.status) where.status = query.status.toUpperCase();
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const [rows, total] = await Promise.all([
      this.db.page.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          status: true,
          editorType: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.db.page.count({ where }),
    ]);
    return { items: rows as PageDashboardRow[], total };
  }

  async funnelBindings(pageIds: string[]): Promise<PageFunnelBinding[]> {
    if (pageIds.length === 0) return [];
    const funnels = await this.db.funnel.findMany({ select: { id: true, name: true, steps: true } });
    const wanted = new Set(pageIds);
    const bindings: PageFunnelBinding[] = [];
    for (const f of funnels) {
      const steps = Array.isArray(f.steps) ? (f.steps as Array<{ pageId?: string }>) : [];
      const seen = new Set<string>();
      for (const s of steps) {
        if (s?.pageId && wanted.has(s.pageId) && !seen.has(s.pageId)) {
          seen.add(s.pageId);
          bindings.push({ pageId: s.pageId, funnelId: f.id, funnelName: f.name });
        }
      }
    }
    return bindings;
  }

  async findDetail(pageId: string): Promise<PageDetailRow | null> {
    const row = (await this.db.page.findFirst({ where: { id: pageId } })) as DetailSelectRow | null;
    return row ? toDetail(row) : null;
  }

  async findBySlug(slug: string): Promise<PageDetailRow | null> {
    const row = (await this.db.page.findFirst({ where: { slug } })) as DetailSelectRow | null;
    return row ? toDetail(row) : null;
  }

  async create(input: CreatePageInput): Promise<PageDetailRow> {
    const status = input.status ?? 'DRAFT';
    const data: Record<string, unknown> = {
      name: input.name,
      slug: input.slug,
      type: PAGE_TYPE_DB[input.type] ?? input.type.toUpperCase(),
      editorType: input.editorType ?? 'PUCK',
      status,
    };
    if (input.templateName !== undefined) data.templateName = input.templateName;
    if (input.draftData !== undefined) data.draftData = input.draftData;
    if (input.publishedData !== undefined) data.publishedData = input.publishedData;
    if (input.meta !== undefined) data.meta = input.meta;
    if (status === 'PUBLISHED') {
      data.publishState = 'published';
      data.publishedAt = new Date();
    }
    const row = await this.db.page.create({ data: data as never });
    return toDetail(row as unknown as DetailSelectRow);
  }

  async update(pageId: string, input: UpdatePageInput): Promise<PageDetailRow> {
    const current = await this.db.page.findFirst({ where: { id: pageId } });
    if (!current) throw new Error('Page not found');
    const data: Prisma.PageUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.draftData !== undefined) data.draftData = input.draftData as Prisma.InputJsonValue;
    if (input.publishedData !== undefined) data.publishedData = input.publishedData as Prisma.InputJsonValue;
    if (input.htmlContent !== undefined) data.htmlContent = input.htmlContent;
    if (input.draftHtml !== undefined) data.draftHtml = input.draftHtml;
    if (input.draftSettings !== undefined) data.draftSettings = input.draftSettings as Prisma.InputJsonValue;
    if (input.settings !== undefined) data.settings = input.settings as Prisma.InputJsonValue;
    if (input.meta !== undefined) data.meta = input.meta as Prisma.InputJsonValue;
    if (input.planContent !== undefined) data.planContent = input.planContent as Prisma.InputJsonValue;

    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === 'PUBLISHED') {
        data.publishedAt = new Date();
        const row = current as unknown as DetailSelectRow;
        if (input.publishedData === undefined && input.draftData === undefined) {
          data.publishedData = (row.draftData ?? undefined) as Prisma.InputJsonValue | undefined;
        }
        if (row.editorType === 'HTML') {
          const html = input.draftHtml ?? row.draftHtml ?? row.htmlContent ?? undefined;
          const settings = (input.draftSettings ?? row.draftSettings ?? row.settings ?? undefined) as
            | Prisma.InputJsonValue
            | undefined;
          if (html !== undefined) {
            data.htmlContent = html;
            data.draftHtml = html;
          }
          if (settings !== undefined) {
            data.settings = settings;
            data.draftSettings = settings;
          }
        }
      }
    }

    await this.db.page.update({ where: { id: pageId }, data });
    const updated = await this.findDetail(pageId);
    if (!updated) throw new Error('Page not found after update');
    return updated;
  }

  private copyData(source: PageDetailRow): Prisma.PageUncheckedUpdateInput {
    return {
      draftData: (source.publishedData ?? source.draftData ?? undefined) as Prisma.InputJsonValue | undefined,
      htmlContent: source.htmlContent,
      draftHtml: source.draftHtml,
      draftSettings: (source.draftSettings ?? undefined) as Prisma.InputJsonValue | undefined,
      settings: (source.settings ?? undefined) as Prisma.InputJsonValue | undefined,
      meta: (source.meta ?? { title: source.name }) as Prisma.InputJsonValue,
    };
  }

  async copyToNew(source: PageDetailRow, name: string, slug: string): Promise<PageDetailRow> {
    const row = await this.db.page.create({
      data: {
        name,
        slug,
        type: source.type,
        templateName: source.templateName,
        editorType: source.editorType,
        status: 'DRAFT',
        ...this.copyData(source),
      } as never,
    });
    return toDetail(row as unknown as DetailSelectRow);
  }

  async copyOnto(source: PageDetailRow, targetPageId: string): Promise<PageDetailRow | null> {
    const target = await this.db.page.findFirst({ where: { id: targetPageId } });
    if (!target) return null;
    await this.db.page.update({
      where: { id: targetPageId },
      data: {
        ...this.copyData(source),
        editorType: source.editorType,
        templateName: source.templateName,
        status: 'DRAFT',
      },
    });
    return this.findDetail(targetPageId);
  }

  async delete(pageId: string): Promise<boolean> {
    const result = await this.db.page.deleteMany({ where: { id: pageId } });
    return result.count > 0;
  }

  async invalidateCache(pageId: string, slug: string): Promise<void> {
    await this.invalidate(this.tenantId, pageId, slug);
  }
}
