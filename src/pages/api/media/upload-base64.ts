import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { makeAiMediaUpload } from '@/composition/make-ai-media-deps';
import { createLogger } from '@/lib/logger';

const logger = createLogger('MediaUploadBase64Route');

interface UploadBody {
  images?: { base64: string; fileName?: string }[];
}

function decode(dataUrl: string): { bytes: Uint8Array; contentType: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { contentType: match[1], bytes: Uint8Array.from(Buffer.from(match[2], 'base64')) };
}

export const POST: APIRoute = async (ctx) => {
  requireFeature('SETTINGS_LLM');
  const body = (await ctx.request.json()) as UploadBody;
  if (!body.images?.length) return new Response(JSON.stringify({ error: 'images required' }), { status: 400 });
  if (body.images.length > 10) return new Response(JSON.stringify({ error: 'too_many' }), { status: 400 });

  try {
    const upload = await makeAiMediaUpload(ctx);
    const results: { assetId: string; url: string; fileName?: string }[] = [];
    for (const image of body.images) {
      const decoded = decode(image.base64 ?? '');
      if (!decoded) return new Response(JSON.stringify({ error: 'invalid_format' }), { status: 400 });
      const { assetId, url } = await upload.store(decoded);
      results.push({ assetId, url, fileName: image.fileName });
    }
    return new Response(JSON.stringify({ images: results }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    logger.error('base64 upload failed', { error: err });
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
  }
};
