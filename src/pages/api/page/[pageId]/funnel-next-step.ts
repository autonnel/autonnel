import { defineRoute, ApiError } from '@/lib/api/define-route';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { nextStepInWorkflow } from '@/lib/funnel-step-order';
import type { FunnelNextStepDto } from '@/contracts/pages';

// Funnel steps stored as JSON ([{ stepSlug, pageId }]); URL prefix is /n/:funnelId/:stepSlug.
// "Next" follows workflow order (landing→checkout→upsell→thankyou), not raw array order.
export const GET = defineRoute('GET /api/page/:pageId/funnel-next-step', { feature: 'PAGES' }, async ({ params }) => {
  const pageId = params.pageId;
  if (!pageId) throw new ApiError(400, 'Page ID is required');

  const db = getTenantPrisma();
  const funnels = await db.funnel.findMany({ select: { id: true, name: true, steps: true } });

  for (const f of funnels) {
    const steps = Array.isArray(f.steps) ? (f.steps as Array<{ stepSlug?: string; pageId?: string }>) : [];
    if (!steps.some((s) => s?.pageId === pageId)) continue;
    const ids = steps.map((s) => s?.pageId).filter((id): id is string => !!id);
    const stepPages = await db.page.findMany({ where: { id: { in: ids } }, select: { id: true, type: true } });
    const typeById = new Map(stepPages.map((p) => [p.id, p.type as string | null]));
    const { next } = nextStepInWorkflow(steps, typeById, pageId);
    const result: FunnelNextStepDto = {
      nextStepUrl: next?.stepSlug ? `/n/${f.id}/${next.stepSlug}` : null,
      funnelId: f.id,
      funnelName: f.name,
      currentPageType: null,
    };
    return result;
  }

  return { nextStepUrl: null, funnelId: null, funnelName: null, currentPageType: null } satisfies FunnelNextStepDto;
});
