import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { withApiPrincipal } from '@/composition/external-auth';
import { authoringDepsFromLocals } from '@/composition/authoring-runtime';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ExternalFunnelPagesRoute');

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
        select: { id: true, steps: true },
      });
      if (!funnel) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

      const rawSteps = (Array.isArray(funnel.steps) ? funnel.steps : []) as FunnelStep[];
      const slugByPageId = new Map(
        rawSteps.filter((s) => s?.pageId).map((s) => [s.pageId as string, s.stepSlug ?? null]),
      );
      const pageIds = [...slugByPageId.keys()];

      const livePages = pageIds.length
        ? await db.page.findMany({
            where: { id: { in: pageIds }, status: 'PUBLISHED' },
            select: { id: true, slug: true, name: true, type: true },
          })
        : [];

      const pages = livePages.map((p) => ({
        pageId: p.id,
        slug: p.slug,
        name: p.name,
        type: p.type,
        stepSlug: slugByPageId.get(p.id) ?? null,
      }));

      return new Response(JSON.stringify({ pages }), { status: 200 });
    } catch (error) {
      logger.error('List published funnel pages failed', { error, funnelId: context.params.funnelId });
      return new Response(JSON.stringify({ error: 'Failed to read funnel pages' }), { status: 500 });
    }
  });
