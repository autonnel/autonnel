import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeAuthoring } from '@/composition/make-authoring';
import { authoringDepsFromLocals } from '@/composition/authoring-runtime';
import { PageDashboardError } from '@/modules/authoring/application/page-dashboard-service';

export const POST = defineRoute('POST /api/page/:pageId/publish', { feature: 'PAGES' }, async ({ params, locals }) => {
  const authoring = makeAuthoring(authoringDepsFromLocals(locals));
  try {
    // Publishing promotes the current draft to live: status -> PUBLISHED and draftData is
    // copied into publishedData (what the storefront reads). This is the same path the Puck/HTML
    // editors use via PUT. The DDD PagePublishingService/PublicationStore path operates on the
    // unused draftDocument column and never lands on the storefront, so it is intentionally bypassed.
    await authoring.pageDashboard.update(params.pageId!, { status: 'PUBLISHED' });
    return { ok: true } as const;
  } catch (err) {
    if (err instanceof PageDashboardError) throw new ApiError(err.status, err.message);
    throw err;
  }
});
