import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { callText, LlmNotConfiguredError } from '@/lib/llm';

interface ComponentBody {
  prompt?: string;
  modelName?: string;
}

export const POST: APIRoute = async (ctx) => {
  requireFeature('SETTINGS_LLM');
  const body = (await ctx.request.json()) as ComponentBody;
  if (!body.prompt?.trim()) return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400 });
  try {
    const text = await callText({ modelName: body.modelName, messages: [{ role: 'user', content: body.prompt }] });
    return new Response(JSON.stringify({ text, inlineText: text }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return new Response(JSON.stringify({ error: 'model_unavailable', message: 'no text model configured in Settings → LLM' }), { status: 422 });
    }
    throw err;
  }
};
