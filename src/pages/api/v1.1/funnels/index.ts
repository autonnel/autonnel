import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { withApiPrincipal } from '@/composition/external-auth';
import { authoringDepsFromLocals } from '@/composition/authoring-runtime';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ExternalFunnelsRoute');

export const GET: APIRoute = (context) =>
  withApiPrincipal(context, async () => {
    requireFeature('FUNNELS');
    const { db } = authoringDepsFromLocals(context.locals);
    try {
      const rows = await db.funnel.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, steps: true, updatedAt: true },
      });
      const funnels = rows.map((f) => ({
        funnelId: f.id,
        name: f.name,
        stepCount: Array.isArray(f.steps) ? f.steps.length : 0,
        updatedAt: f.updatedAt,
      }));
      return new Response(JSON.stringify({ funnels }), { status: 200 });
    } catch (error) {
      logger.error('List published funnels failed', { error });
      return new Response(JSON.stringify({ error: 'Failed to list published funnels' }), { status: 500 });
    }
  });
