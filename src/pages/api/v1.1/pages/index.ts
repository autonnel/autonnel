import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { withApiPrincipal } from '@/composition/external-auth';
import { authoringDepsFromLocals } from '@/composition/authoring-runtime';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ExternalPagesRoute');

export const GET: APIRoute = (context) =>
  withApiPrincipal(context, async () => {
    requireFeature('PAGES');
    const { db } = authoringDepsFromLocals(context.locals);
    try {
      const rows = await db.page.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { slug: 'asc' },
        select: { id: true, slug: true, name: true, type: true, updatedAt: true },
      });
      const pages = rows.map((p) => ({
        pageId: p.id,
        slug: p.slug,
        name: p.name,
        type: p.type,
        updatedAt: p.updatedAt,
      }));
      return new Response(JSON.stringify({ pages }), { status: 200 });
    } catch (error) {
      logger.error('List published pages failed', { error });
      return new Response(JSON.stringify({ error: 'Failed to list published pages' }), { status: 500 });
    }
  });
