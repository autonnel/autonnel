import type { APIRoute } from 'astro';
import { requireFeature, getPrincipal } from '@/modules/identity/published/principal';
import { isUserPrincipal } from '@/modules/shared-kernel/principal';
import { uploadBase64Image } from '@/lib/s3';
import { requireS3Config } from '@/lib/config/storage';
import { getSiteUploadContext, buildUrlFromContext } from '@/lib/services/site-upload';
import { createLogger } from '@/lib/logger';

const logger = createLogger('AiImageUpload');
const MAX_IMAGES = 10;
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

interface UploadRequest {
  images: { base64: string; fileName: string }[];
}

function err(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

// Response shape: { images: { url, key, fileName }[] }
export const POST: APIRoute = async ({ request }) => {
  await requireFeature('PAGES');
  const principal = getPrincipal();
  const userId = principal && isUserPrincipal(principal) ? principal.userId : 'anon';

  const body = (await request.json().catch(() => null)) as UploadRequest | null;
  if (!body?.images || !Array.isArray(body.images) || body.images.length === 0) {
    return err('No images provided', 400);
  }
  if (body.images.length > MAX_IMAGES) {
    return err(`Maximum ${MAX_IMAGES} images allowed`, 400);
  }

  const s3Config = await requireS3Config();
  const uploadCtx = await getSiteUploadContext();

  const results: { url: string; key: string; fileName: string }[] = [];

  for (const image of body.images) {
    if (!image.base64?.startsWith('data:image/')) {
      return err('Invalid image format', 400);
    }
    const base64Data = image.base64.split(',')[1] ?? image.base64;
    const sizeBytes = Math.ceil((base64Data.length * 3) / 4);
    if (sizeBytes > MAX_SIZE_BYTES) {
      return err(`Image "${image.fileName}" exceeds 10 MB`, 400);
    }
    try {
      const key = await uploadBase64Image(image.base64, `ai-chat/${userId}`, s3Config);
      const url = uploadCtx ? buildUrlFromContext(key, uploadCtx) : `/${key}`;
      results.push({ url, key, fileName: image.fileName });
    } catch (e) {
      logger.error('Failed to upload AI chat image', { fileName: image.fileName, error: e });
      return err(`Failed to upload image: ${image.fileName}`, 500);
    }
  }

  return new Response(JSON.stringify({ images: results }), { status: 200, headers: { 'content-type': 'application/json' } });
};
