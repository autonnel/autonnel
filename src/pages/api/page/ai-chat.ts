import type { APIRoute } from 'astro';
import type { ModelMessage } from 'ai';
import { requireFeature } from '@/modules/identity/published/principal';
import { resolveLlmModel } from '@/lib/ai/provider';
import { createPageTools } from '@/lib/ai/page-tools';
import { runPageBuilderAgent } from '@/lib/ai/agent';
import { getComponentCatalog } from '@/components/builder/config';
import { LlmNotConfiguredError } from '@/lib/llm/errors';
import { createLogger } from '@/lib/logger';

const logger = createLogger('AiChat');

interface ChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; text: string; images?: string[] }>;
  currentData: {
    root?: { props?: Record<string, any> };
    content?: Array<{ type: string; props: Record<string, any> }>;
  };
  selectedComponent?: {
    index: number;
    type: string;
    props: Record<string, any>;
  };
  modelName?: string;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

export const POST: APIRoute = async (ctx) => {
  await requireFeature('PAGES');
  let body: ChatRequest;
  try {
    body = await ctx.request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { messages, currentData, selectedComponent, modelName } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return jsonError('Missing or empty messages array', 400);
  }

  const content = currentData?.content ?? [];
  const root = currentData?.root?.props ?? {};

  let resolved;
  try {
    resolved = await resolveLlmModel(modelName);
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return jsonError(error.message, 412);
    }
    logger.error('Failed to resolve LLM provider', { error });
    return jsonError('Failed to resolve LLM configuration', 500);
  }

  const catalog = getComponentCatalog();
  const pageState = {
    root: { ...root },
    content: content.map((c: any) => ({ type: c.type, props: { ...c.props } })),
  };


  const useTools = resolved.protocol === 'anthropic';
  let aiTools: ReturnType<typeof createPageTools>['tools'] | undefined;
  let getPageState: (() => typeof pageState) | undefined;

  if (useTools) {
    const pageTools = createPageTools(pageState, catalog);
    aiTools = pageTools.tools;
    getPageState = pageTools.getPageState;
  }


  const enrichedMessages = selectedComponent
    ? messages.map((m, i) => {
        if (i === messages.length - 1 && m.role === 'user') {
          return {
            ...m,
            text: `[Selected component: index ${selectedComponent.index}, type "${selectedComponent.type}", props: ${JSON.stringify(selectedComponent.props).substring(0, 500)}]\n\n${m.text}`,
          };
        }
        return m;
      })
    : messages;

  const modelMessages: ModelMessage[] = enrichedMessages.map((m) => {
    const hasImages = m.images && m.images.length > 0;
    if (hasImages) {
      const urlList = m.images!
        .map((u, i) => `${i + 1}. ${u}`)
        .join('\n');
      const annotatedText = `${m.text || 'Analyze this image.'}\n\n[Reference image URLs available to you — use them in MediaFieldValue.referenceImageUrl fields when you want the page generator to base the image on one of these]:\n${urlList}`;
      return {
        role: m.role,
        content: [
          { type: 'text' as const, text: annotatedText },
          ...m.images!.map((url) => ({ type: 'image' as const, image: url })),
        ],
      } as ModelMessage;
    }
    return { role: m.role, content: m.text } as ModelMessage;
  });

  logger.info('Agent generate starting', {
    modelId: resolved.modelId,
    protocol: resolved.protocol,
    useTools,
    messageCount: modelMessages.length,
    contentCount: content.length,
    imageCount: messages.reduce((sum, m) => sum + (m.images?.length ?? 0), 0),
    toolCount: aiTools ? Object.keys(aiTools).length : 0,
  });

  if (useTools) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (evt: unknown) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(evt) + '\n'));
          } catch {
          }
        };

        send({ type: 'start' });

        const pingTimer = setInterval(() => send({ type: 'ping' }), 10_000);

        try {
          const result = await runPageBuilderAgent({
            model: resolved.model,
            componentCatalog: catalog,
            pageState: undefined,
            messages: modelMessages,
            tools: aiTools,
            maxSteps: 20,
            onEvent: (event) => send(event),
          });

          logger.info('Agent generate result', {
            textLength: result.text?.length ?? 0,
            finishReason: result.finishReason,
            steps: result.steps?.length,
            usage: result.usage,
          });

          const finalState = getPageState?.() ?? pageState;
          const explanation = result.text?.trim() || 'Done.';
          send({
            type: 'done',
            explanation,
            content: finalState.content,
            root: finalState.root,
          });
        } catch (error) {
          logger.error('Agent generation failed', { error });
          send({
            type: 'error',
            error: error instanceof Error ? error.message : 'AI generation failed',
          });
        } finally {
          clearInterval(pingTimer);
          try {
            controller.close();
          } catch {
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
  }

  try {
    const result = await runPageBuilderAgent({
      model: resolved.model,
      componentCatalog: catalog,
      pageState,
      messages: modelMessages,
      tools: undefined,
    });

    logger.info('Agent generate result', {
      hasObject: !!result.object,
      textLength: result.text?.length ?? 0,
      finishReason: result.finishReason,
      usage: result.usage,
    });

    const finalState = pageState;
    const obj = result.object;
    const explanation =
      obj?.explanation || result.text?.trim() || 'I was unable to process your request. Please try rephrasing.';
    const newContent = obj?.content?.length ? obj.content : finalState.content;
    const newRoot = obj?.root && Object.keys(obj.root).length ? obj.root : finalState.root;

    if (!obj && (!result.text || !result.text.trim())) {
      return jsonResponse({
        explanation: 'I was unable to process your request. Please try rephrasing.',
        content,
        root,
      });
    }

    return jsonResponse({ explanation, content: newContent, root: newRoot });
  } catch (error) {
    logger.error('Agent generation failed', { error });
    return jsonError('AI generation failed. Please try again.', 500);
  }
};
