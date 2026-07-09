import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { withApiPrincipal } from '@/composition/external-auth';
import { authoringDepsFromLocals } from '@/composition/authoring-runtime';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ExternalFunnelRoute');

interface FunnelStep {
  stepSlug?: string;
  pageId?: string;
}

export const GET: APIRoute = (context) =>
  withApiPrincipal(context, async () => {
    requireFeature('FUNNELS');
    const { db } = authoringDepsFromLocals(context.locals);
    try {
      const funnel = await db.funnel.findUnique({
        where: { id: context.params.funnelId! },
        select: { id: true, name: true, steps: true, updatedAt: true },
      });
      if (!funnel) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

      const rawSteps = (Array.isArray(funnel.steps) ? funnel.steps : []) as FunnelStep[];
      const pageIds = rawSteps.map((s) => s?.pageId).filter((id): id is string => !!id);
      const pages = pageIds.length
        ? await db.page.findMany({ where: { id: { in: pageIds } }, select: { id: true, type: true } })
        : [];
      const typeById = new Map(pages.map((p) => [p.id, p.type]));

      const steps = rawSteps.map((s) => ({
        pageId: s?.pageId ?? null,
        stepSlug: s?.stepSlug ?? null,
        type: s?.pageId ? typeById.get(s.pageId) ?? null : null,
      }));

      const body = { funnelId: funnel.id, name: funnel.name, steps, updatedAt: funnel.updatedAt };
      return new Response(JSON.stringify({ funnel: body }), { status: 200 });
    } catch (error) {
      logger.error('Get published funnel failed', { error, funnelId: context.params.funnelId });
      return new Response(JSON.stringify({ error: 'Failed to read published funnel' }), { status: 500 });
    }
  });
