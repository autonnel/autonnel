import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeAuthoring } from '@/composition/make-authoring';
import { authoringDepsFromLocals } from '@/composition/authoring-runtime';
import { PageDashboardError } from '@/modules/authoring/application/page-dashboard-service';
import { toPageDetailDto } from './index';

export const POST = defineRoute('POST /api/page/copy', { feature: 'PAGES', status: 201 }, async ({ input, locals }) => {
  if (!input) throw new ApiError(400, 'Invalid JSON body');
  const authoring = makeAuthoring(authoringDepsFromLocals(locals));
  try {
    return toPageDetailDto(await authoring.pageDashboard.copy(input));
  } catch (err) {
    if (err instanceof PageDashboardError) throw new ApiError(err.status, err.message);
    throw err;
  }
});
