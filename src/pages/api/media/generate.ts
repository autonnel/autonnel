import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import {
  enqueueMediaGeneration, readMediaJob, isMediaModelConfigured, type MediaKind,
} from '@/composition/make-media-generation';

interface GenerateBody {
  type?: string;
  prompt?: string;
  aspectRatio?: string;
  inputImage?: string;
  modelName?: string;
  duration?: number;
}

export const POST: APIRoute = async (ctx) => {
  requireFeature('SETTINGS_LLM');
  const body = (await ctx.request.json()) as GenerateBody;
  if (!body.prompt?.trim()) {
    return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400 });
  }
  const type: MediaKind = body.type === 'video' ? 'video' : 'image';
  if (!(await isMediaModelConfigured(type, body.modelName))) {
    return new Response(
      JSON.stringify({ error: 'model_unavailable', message: `no ${type} model configured in Settings → LLM` }),
      { status: 422 },
    );
  }
  const { id } = await enqueueMediaGeneration(ctx.locals, {
    type,
    prompt: body.prompt.trim(),
    aspectRatio: body.aspectRatio,
    inputImage: body.inputImage,
    modelName: body.modelName,
    duration: body.duration,
  });
  return new Response(JSON.stringify({ id }), { status: 200, headers: { 'content-type': 'application/json' } });
};

export const GET: APIRoute = async (ctx) => {
  const id = new URL(ctx.request.url).searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
  const view = await readMediaJob(id);
  if (!view) return new Response(JSON.stringify({ status: 'ERROR', error: 'not_found' }), { status: 404 });
  return new Response(JSON.stringify(view), { status: 200, headers: { 'content-type': 'application/json' } });
};
