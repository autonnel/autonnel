import type { APIRoute } from 'astro';
import { withApiPrincipal } from '@/composition/external-auth';
import { makeAiMediaUpload } from '@/composition/make-ai-media-deps';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ExternalMediaUploadRoute');

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];

export const POST: APIRoute = (context) =>
  withApiPrincipal(context, async (principal) => {
    if (!principal.writeAccess) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
    }
    const form = await context.request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return new Response(JSON.stringify({ error: 'file required' }), { status: 400 });
    if (!ALLOWED.includes(file.type)) return new Response(JSON.stringify({ error: 'invalid_type' }), { status: 400 });

    try {
      const upload = await makeAiMediaUpload(context);
      const { assetId, url } = await upload.store({
        bytes: new Uint8Array(await file.arrayBuffer()),
        contentType: file.type,
      });
      return new Response(JSON.stringify({ assetId, url }), { status: 201, headers: { 'content-type': 'application/json' } });
    } catch (err) {
      logger.error('external upload failed', { error: err });
      return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
    }
  }) as Promise<Response>;
