import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { withApiPrincipal } from '@/composition/external-auth';
import { authoringDepsFromLocals } from '@/composition/authoring-runtime';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ExternalPageRoute');

export const GET: APIRoute = (context) =>
  withApiPrincipal(context, async () => {
    requireFeature('PAGES');
    const { db } = authoringDepsFromLocals(context.locals);
    try {
      const page = await db.page.findUnique({
        where: { id: context.params.pageId! },
        select: {
          id: true,
          slug: true,
          name: true,
          type: true,
          editorType: true,
          publishedData: true,
          htmlContent: true,
          meta: true,
          status: true,
          updatedAt: true,
        },
      });
      if (!page || page.status !== 'PUBLISHED') {
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
      }
      const body = {
        pageId: page.id,
        slug: page.slug,
        name: page.name,
        type: page.type,
        editorType: page.editorType,
        document: page.publishedData,
        html: page.htmlContent ?? null,
        meta: page.meta,
        updatedAt: page.updatedAt,
      };
      return new Response(JSON.stringify({ page: body }), { status: 200 });
    } catch (error) {
      logger.error('Get published page failed', { error, pageId: context.params.pageId });
      return new Response(JSON.stringify({ error: 'Failed to read published page' }), { status: 500 });
    }
  });
