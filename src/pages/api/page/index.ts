import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeAuthoring } from '@/composition/make-authoring';
import { authoringDepsFromLocals } from '@/composition/authoring-runtime';
import { PageDashboardError, type PageDetailRow } from '@/modules/authoring/application/page-dashboard-service';
import type { PageDetailDto } from '@/contracts/pages';
import { getTemplateData } from '@/lib/templates';

export function toPageDetailDto(row: PageDetailRow): PageDetailDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    status: row.status,
    editorType: row.editorType,
    templateName: row.templateName,
    draftData: row.draftData,
    publishedData: row.publishedData,
    htmlContent: row.htmlContent,
    draftHtml: row.draftHtml,
    draftSettings: row.draftSettings,
    settings: row.settings,
    meta: row.meta,
    planContent: row.planContent,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const GET = defineRoute('GET /api/page', { feature: 'PAGES' }, async ({ query, locals }) => {
  const authoring = makeAuthoring(authoringDepsFromLocals(locals));
  const result = await authoring.pageDashboard.list({
    search: query.get('q') ?? undefined,
    type: query.get('type') ?? undefined,
    status: query.get('status') ?? undefined,
    page: query.get('page') ? Number(query.get('page')) : undefined,
    perPage: query.get('perPage') ? Number(query.get('perPage')) : undefined,
  });
  return {
    pages: result.items.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      type: p.type,
      status: p.status,
      editorType: p.editorType,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    bindings: result.bindings,
    total: result.total,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
});

export const POST = defineRoute('POST /api/page', { feature: 'PAGES', status: 201 }, async ({ input, locals }) => {
  if (!input) throw new ApiError(400, 'Invalid JSON body');
  const authoring = makeAuthoring(authoringDepsFromLocals(locals));
  try {
    const draftData =
      input.editorType !== 'HTML' && input.templateName ? getTemplateData(input.templateName) : undefined;
    const row = await authoring.pageDashboard.create({ ...input, draftData });
    return toPageDetailDto(row);
  } catch (err) {
    if (err instanceof PageDashboardError) throw new ApiError(err.status, err.message);
    throw err;
  }
});
