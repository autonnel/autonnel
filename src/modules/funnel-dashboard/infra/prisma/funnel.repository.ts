// tenantId is auto-injected by the Prisma extension on every write/where.
import type { FunnelRepository, FunnelSummary } from '../../application/ports';

type Client = ReturnType<typeof import('../../../platform/infra/prisma-tenant-extension').getTenantPrisma>;

interface FunnelRow {
  id: string;
  name: string;
  description: string | null;
  steps: unknown;
  transitions: unknown;
  createdAt: Date;
  updatedAt: Date;
}

interface FunnelStep {
  stepSlug: string;
  pageId: string;
}

interface PageCloneRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  editorType: string;
  templateName: string | null;
  draftData: unknown;
  publishedData: unknown;
  draftDocument: unknown;
  htmlContent: string | null;
  draftHtml: string | null;
  settings: unknown;
  draftSettings: unknown;
  seo: unknown;
  meta: unknown;
}

function toSummary(row: FunnelRow): FunnelSummary {
  return { id: row.id, name: row.name, description: row.description, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export class PrismaFunnelDashboardRepository implements FunnelRepository {
  constructor(private readonly db: Client) {}

  async list(): Promise<FunnelSummary[]> {
    const rows = await this.db.funnel.findMany({ orderBy: { updatedAt: 'desc' } });
    return rows.map((r) => toSummary(r as unknown as FunnelRow));
  }

  async findById(id: string): Promise<FunnelSummary | null> {
    const row = await this.db.funnel.findFirst({ where: { id } });
    return row ? toSummary(row as unknown as FunnelRow) : null;
  }

  async create(input: { name: string; description: string | null }): Promise<FunnelSummary> {
    const row = await this.db.funnel.create({
      data: { name: input.name, description: input.description } as never,
    });
    return toSummary(row as unknown as FunnelRow);
  }

  async update(id: string, patch: { name?: string; description?: string | null }): Promise<FunnelSummary | null> {
    const result = await this.db.funnel.updateMany({ where: { id }, data: patch as never });
    if (result.count === 0) return null;
    const row = await this.db.funnel.findFirst({ where: { id } });
    return row ? toSummary(row as unknown as FunnelRow) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.funnel.deleteMany({ where: { id } });
    return result.count > 0;
  }

  async duplicate(id: string, name: string, opts?: { clonePages?: boolean }): Promise<FunnelSummary | null> {
    const source = (await this.db.funnel.findFirst({ where: { id } })) as unknown as FunnelRow | null;
    if (!source) return null;
    const steps = opts?.clonePages ? await this.cloneStepPages(source.steps) : source.steps;
    const row = await this.db.funnel.create({
      data: {
        name,
        description: source.description,
        steps,
        transitions: source.transitions,
      } as never,
    });
    return toSummary(row as unknown as FunnelRow);
  }

  // For "duplicate as variant arm": give the copy its own pages so editing the variant never
  // mutates the control's pages. Without this the arm shares the control's pageIds and the
  // experiment is a no-op. A shared page is cloned once even if several steps reference it.
  private async cloneStepPages(rawSteps: unknown): Promise<FunnelStep[]> {
    const steps = Array.isArray(rawSteps) ? (rawSteps as FunnelStep[]) : [];
    const clonedPageIds = new Map<string, string>();
    const result: FunnelStep[] = [];
    for (const step of steps) {
      if (!step?.pageId) {
        result.push(step);
        continue;
      }
      let newPageId = clonedPageIds.get(step.pageId);
      if (!newPageId) {
        newPageId = (await this.clonePage(step.pageId)) ?? step.pageId;
        clonedPageIds.set(step.pageId, newPageId);
      }
      result.push({ ...step, pageId: newPageId });
    }
    return result;
  }

  private async clonePage(pageId: string): Promise<string | null> {
    const source = (await this.db.page.findFirst({ where: { id: pageId } })) as unknown as PageCloneRow | null;
    if (!source) return null;
    const slug = await this.uniqueSlug(source.slug);
    const created = (await this.db.page.create({
      data: {
        name: source.name ? `${source.name} (Copy)` : source.name,
        slug,
        type: source.type,
        editorType: source.editorType,
        templateName: source.templateName,
        status: 'DRAFT',
        publishState: 'draft',
        draftData: (source.publishedData ?? source.draftData ?? undefined) as never,
        draftDocument: (source.draftDocument ?? undefined) as never,
        htmlContent: source.htmlContent,
        draftHtml: source.draftHtml ?? source.htmlContent,
        settings: (source.settings ?? undefined) as never,
        draftSettings: (source.draftSettings ?? source.settings ?? undefined) as never,
        seo: (source.seo ?? undefined) as never,
        meta: (source.meta ?? undefined) as never,
      } as never,
    })) as { id: string };
    return created.id;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = `${base}-copy`;
    let n = 2;
    while (await this.db.page.findFirst({ where: { slug: candidate }, select: { id: true } })) {
      candidate = `${base}-copy-${n++}`;
    }
    return candidate;
  }
}
