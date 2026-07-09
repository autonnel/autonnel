import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { uploadToS3 } from '@/lib/s3';
import { getSiteUploadContext, buildUrlFromContext } from '@/lib/services/site-upload';
import { requireS3Config } from '@/lib/config/storage';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'application/pdf',
];

function err(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ params, request }) => {
  await requireFeature('PAGES');

  const uploadCtx = await getSiteUploadContext();
  if (!uploadCtx) return err('Storage context unavailable', 404);

  const s3Config = await requireS3Config();

  const page = await getTenantPrisma().page.findFirst({ where: { id: params.pageId } });
  if (!page) return err('Page not found', 404);

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return err('No file provided', 400);

  if (!ALLOWED_TYPES.includes(file.type)) {
    return err(`File type not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}`, 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return err(`File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const folder = `pages/${params.pageId}/assets`;
  const key = await uploadToS3(buffer, file.name, file.type, folder, s3Config);
  const fullUrl = buildUrlFromContext(key, uploadCtx);

  return new Response(JSON.stringify({ data: [fullUrl] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
