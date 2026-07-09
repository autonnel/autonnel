import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { makeAiMediaUpload } from '@/composition/make-ai-media-deps';
import { createLogger } from '@/lib/logger';

const logger = createLogger('MediaUploadRoute');

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];
const MAX_SIZE = 50 * 1024 * 1024;

export const POST: APIRoute = async (ctx) => {
  requireFeature('SETTINGS_LLM');
  const form = await ctx.request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return new Response(JSON.stringify({ error: 'file required' }), { status: 400 });
  if (!ALLOWED.includes(file.type)) return new Response(JSON.stringify({ error: 'invalid_type' }), { status: 400 });
  if (file.size > MAX_SIZE) return new Response(JSON.stringify({ error: 'too_large' }), { status: 400 });

  try {
    const upload = await makeAiMediaUpload(ctx);
    const { assetId, url } = await upload.store({
      bytes: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
    });
    return new Response(JSON.stringify({ assetId, url }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    logger.error('upload failed', { error: err });
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
  }
};
