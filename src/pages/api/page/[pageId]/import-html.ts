import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { getSiteUploadContext } from '@/lib/services/site-upload';
import { requireS3Config } from '@/lib/config/storage';
import { createLogger } from '@/lib/logger';
import {
  importPage,
  BrowserRenderingHttpError,
  CloudflareChallengeError,
} from '@/lib/services/page-import';

const logger = createLogger('HtmlImportAPI');

interface ImportRequest {
  url: string;
}

function err(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

export const POST: APIRoute = async ({ params, request }) => {
  await requireFeature('PAGES');
  const { pageId } = params;
  if (!pageId) return err('pageId is required', 400);

  const body = (await request.json().catch(() => null)) as ImportRequest | null;
  if (!body?.url) return err('url is required', 400);

  const uploadCtx = await getSiteUploadContext();
  if (!uploadCtx) return err('Storage context unavailable', 404);

  const s3Config = await requireS3Config();
  const db = getTenantPrisma();
  const page = await db.page.findFirst({ where: { id: pageId } });
  if (!page) return err('Page not found', 404);

  try {
    const result = await importPage({ url: body.url, pageId, uploadCtx, s3Config });
    return new Response(
      JSON.stringify({ html: result.html, replacements: result.migrated, tier: result.tier }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  } catch (e) {
    if (e instanceof CloudflareChallengeError) {
      logger.warn('Cloudflare challenge detected', { url: body.url });
      return err('Source site returned a bot challenge. Try a different URL.', 400);
    }
    if (e instanceof BrowserRenderingHttpError) {
      logger.error('Browser Rendering failed', { status: e.status, url: body.url });
      return err(`Browser Rendering failed: ${e.message}`, 502);
    }
    logger.error('Import failed', { url: body.url, error: e });
    return err(`Failed to import: ${e instanceof Error ? e.message : String(e)}`, 400);
  }
};
