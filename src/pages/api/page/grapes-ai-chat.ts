import type { APIRoute } from 'astro';
import type { ModelMessage } from 'ai';
import { requireFeature } from '@/modules/identity/published/principal';
import { resolveLlmModel } from '@/lib/ai/provider';
import { createGrapesTools } from '@/lib/ai/grapes-tools';
import { runPageBuilderAgent } from '@/lib/ai/agent';
import { LlmNotConfiguredError } from '@/lib/llm/errors';
import { createLogger } from '@/lib/logger';

const logger = createLogger('GrapesAiChat');

interface GrapesChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; text: string; images?: string[] }>;
  currentPage: { html: string; css: string; selectedAid?: string };
  autoGenerateImages?: boolean;
  modelName?: string;
}

function jsonError(message: string, status: number, code?: string): Response {
  return new Response(JSON.stringify({ error: message, ...(code ? { code } : {}) }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function buildGrapesSystemPrompt(stylingAllowed: boolean): string {
  return [
    'You edit an existing HTML landing page in place using the provided tools.',
    'Every editable element carries a data-aid attribute; target elements by their aid.',
    'Use getCurrentPage to read a fresh snapshot of the HTML and CSS.',
    'Use rewriteText for copy changes, replaceSection to swap a block, and setImagePrompt to',
    'attach a generation prompt to an <img>/<video> by aid.',
    stylingAllowed
      ? 'appendCss is allowed only for the visual tweaks the user explicitly asked for.'
      : 'Do NOT change styling — appendCss is disabled for this request.',
    'Never introduce position:fixed, inset:0, full-viewport overlays, or high z-index.',
    'When done, give a one-sentence summary of what you changed.',
  ].join(' ');
}

export const POST: APIRoute = async ({ request }) => {
  await requireFeature('PAGES');

  let body: GrapesChatRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { messages, currentPage, autoGenerateImages = false, modelName } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return jsonError('Missing or empty messages array', 400);
  }
  if (!currentPage || typeof currentPage.html !== 'string') {
    return jsonError('Missing currentPage', 400);
  }

  let resolved;
  try {
    resolved = await resolveLlmModel(modelName);
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) return jsonError(error.message, 412, error.code);
    logger.error('Failed to resolve LLM provider', { error });
    return jsonError('Failed to resolve LLM configuration', 500);
  }

  const lastUserText = [...messages].reverse().find((m) => m.role === 'user')?.text ?? '';
  const stylingAllowed = /\b(style|color|colour|font|spacing|margin|padding|background|theme|layout)\b/i.test(
    lastUserText,
  );

  const grapes = createGrapesTools(currentPage.html, currentPage.css ?? '', { stylingAllowed });

  const modelMessages: ModelMessage[] = messages.map((m) => {
    if (m.images && m.images.length > 0) {
      const urlList = m.images.map((u, i) => `${i + 1}. ${u}`).join('\n');
      return {
        role: m.role,
        content: [
          { type: 'text' as const, text: `${m.text || 'Analyze this image.'}\n\n[Reference image URLs]:\n${urlList}` },
          ...m.images.map((url) => ({ type: 'image' as const, image: url })),
        ],
      } as ModelMessage;
    }
    return { role: m.role, content: m.text } as ModelMessage;
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (evt: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(evt) + '\n'));
        } catch {
          /* controller closed */
        }
      };

      send({ type: 'start' });
      const pingTimer = setInterval(() => send({ type: 'ping' }), 10_000);

      try {
        const result = await runPageBuilderAgent({
          model: resolved.model,
          componentCatalog: [],
          messages: modelMessages,
          tools: grapes.tools,
          maxSteps: 20,
          systemPrompt: buildGrapesSystemPrompt(stylingAllowed),
          onEvent: (event) => send(event),
        });

        const finalState = grapes.getFinalState();
        send({
          type: 'done',
          explanation: result.text?.trim() || 'Done.',
          html: finalState.html,
          css: finalState.css,
          imagePromptUpdates: finalState.imagePrompts,
          autoGenerateImages,
        });
      } catch (error) {
        logger.error('Grapes agent generation failed', { error });
        send({ type: 'error', error: error instanceof Error ? error.message : 'AI generation failed' });
      } finally {
        clearInterval(pingTimer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
};
