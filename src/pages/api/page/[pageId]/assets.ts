import { defineRoute, ApiError } from '@/lib/api/define-route';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { listObjectsByPrefix } from '@/lib/s3';
import { getSiteUploadContext, buildUrlFromContext } from '@/lib/services/site-upload';
import { requireS3Config } from '@/lib/config/storage';

export const GET = defineRoute('GET /api/page/:pageId/assets', { feature: 'PAGES' }, async ({ params }) => {
  const { pageId } = params;
  const db = getTenantPrisma();
  const page = await db.page.findFirst({ where: { id: pageId } });
  if (!page) throw new ApiError(404, 'Page not found');

  // Storage is optional: with none configured the asset browser shows an empty
  // list rather than erroring (a fresh install has no uploads yet).
  const uploadCtx = await getSiteUploadContext();
  if (!uploadCtx) return { assets: [] };

  const s3Config = await requireS3Config().catch(() => null);
  if (!s3Config) return { assets: [] };
  const prefix = `pages/${pageId}/assets/`;
  const items = await listObjectsByPrefix(prefix, s3Config);
  return {
    assets: items.map((it) => ({
      src: buildUrlFromContext(it.key, uploadCtx),
      size: it.size,
      key: it.key,
    })),
  };
});

export const DELETE = defineRoute('DELETE /api/page/:pageId/assets', { feature: 'PAGES' }, async ({ params, query }) => {
  const { pageId } = params;
  const assetId = query.get('assetId');
  if (!assetId) throw new ApiError(400, 'assetId required');

  const db = getTenantPrisma();
  const page = await db.page.findFirst({ where: { id: pageId } });
  if (!page) throw new ApiError(404, 'Page not found');

  const result = await db.pageAsset.deleteMany({ where: { id: assetId, pageId: pageId! } });
  if (result.count === 0) throw new ApiError(404, 'Asset not found');
  return { success: true } as const;
});
