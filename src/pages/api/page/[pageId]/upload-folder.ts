import type { APIRoute } from 'astro';
import type { Prisma } from '@prisma/client';
import { requireFeature } from '@/modules/identity/published/principal';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { uploadToS3WithKey } from '@/lib/s3';
import { getSiteUploadContext, buildUrlFromContext } from '@/lib/services/site-upload';
import { requireS3Config } from '@/lib/config/storage';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_TOTAL_SIZE = 200 * 1024 * 1024;
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

function sanitizeRelativePath(value: string): string | null {
  const normalized = value.replace(/\\/g, '/').replace(/\0/g, '');
  const parts = normalized
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return null;

  const cleaned = parts.map((part) =>
    part.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/^\.+$/, ''),
  );
  for (const part of cleaned) {
    if (part === '' || part === '.' || part === '..') return null;
  }

  const joined = cleaned.join('/');
  if (joined.length > 512) return null;
  return joined;
}

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
  const files = formData.getAll('files') as File[];
  const paths = formData.getAll('paths') as string[];
  if (files.length === 0) return err('No files provided', 400);

  let totalSize = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const label = paths[i] || file.name;
    if (!ALLOWED_TYPES.includes(file.type)) {
      return err(`File "${label}" type is not allowed`, 400);
    }
    if (file.size > MAX_FILE_SIZE) {
      return err(`File "${label}" exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`, 400);
    }
    totalSize += file.size;
  }

  if (totalSize > MAX_TOTAL_SIZE) {
    return err(`Total upload size exceeds ${MAX_TOTAL_SIZE / 1024 / 1024}MB limit`, 400);
  }

  const dbRecords: Array<{
    pageId: string;
    path: string;
    url: string;
    s3Key: string;
    fileSize: number;
    contentType: string;
  }> = [];
  const uploaded: Array<{ path: string; url: string; size: number }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const raw = paths[i] || file.name;
    const rel = sanitizeRelativePath(raw);
    if (!rel) return err(`Invalid file path: ${raw}`, 400);

    const key = `pages/${params.pageId}/assets/${rel}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadToS3WithKey(buffer, key, file.type, s3Config);
    const fullUrl = buildUrlFromContext(key, uploadCtx);

    dbRecords.push({
      pageId: params.pageId as string,
      path: rel,
      url: fullUrl,
      s3Key: key,
      fileSize: file.size,
      contentType: file.type,
    });
    uploaded.push({ path: rel, url: fullUrl, size: file.size });
  }

  if (dbRecords.length > 0) {
    const db = getTenantPrisma();
    await db.pageAsset.deleteMany({
      where: { pageId: params.pageId, s3Key: { in: dbRecords.map((r) => r.s3Key) } },
    });
    await db.pageAsset.createMany({ data: dbRecords as Prisma.PageAssetCreateManyInput[] });
  }

  return new Response(
    JSON.stringify({ uploaded, count: uploaded.length, totalSize }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
};
