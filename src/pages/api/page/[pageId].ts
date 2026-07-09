import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeAuthoring } from '@/composition/make-authoring';
import { authoringDepsFromLocals } from '@/composition/authoring-runtime';
import { PageDashboardError } from '@/modules/authoring/application/page-dashboard-service';
import { toPageDetailDto } from './index';

export const GET = defineRoute('GET /api/page/:pageId', { feature: 'PAGES' }, async ({ params, locals }) => {
  const authoring = makeAuthoring(authoringDepsFromLocals(locals));
  try {
    return toPageDetailDto(await authoring.pageDashboard.get(params.pageId!));
  } catch (err) {
    if (err instanceof PageDashboardError) throw new ApiError(err.status, err.message);
    throw err;
  }
});

export const PUT = defineRoute('PUT /api/page/:pageId', { feature: 'PAGES' }, async ({ input, params, locals }) => {
  if (!input) throw new ApiError(400, 'Invalid JSON body');
  const authoring = makeAuthoring(authoringDepsFromLocals(locals));
  try {
    return toPageDetailDto(await authoring.pageDashboard.update(params.pageId!, input));
  } catch (err) {
    if (err instanceof PageDashboardError) throw new ApiError(err.status, err.message);
    throw err;
  }
});

export const DELETE = defineRoute('DELETE /api/page/:pageId', { feature: 'PAGES' }, async ({ params, locals }) => {
  const authoring = makeAuthoring(authoringDepsFromLocals(locals));
  try {
    await authoring.pageDashboard.delete(params.pageId!);
    return { success: true } as const;
  } catch (err) {
    if (err instanceof PageDashboardError) throw new ApiError(err.status, err.message);
    throw err;
  }
});
