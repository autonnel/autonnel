import type { APIRoute } from 'astro';
import type { ModelMessage } from 'ai';
import { requireFeature } from '@/modules/identity/published/principal';
import { resolveLlmModel } from '@/lib/ai/provider';
import { createAnalystTools } from '@/lib/ai/analyst-tools';
import { buildAnalystDeps } from '@/composition/analytics/analyst-deps';
import { runAnalystAgent } from '@/lib/ai/agent';
import { LlmNotConfiguredError } from '@/lib/llm/errors';
import { createLogger } from '@/lib/logger';

const logger = createLogger('AnalystChat');

interface AnalystChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; text: string }>;
  funnelId?: string;
  modelName?: string;
}

function jsonError(message: string, status: number, code?: string): Response {
  return new Response(JSON.stringify({ error: message, ...(code ? { code } : {}) }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function buildAnalystSystemPrompt(funnelId: string | undefined, hasTools: boolean): string {
  const lines = [
    'You are an interactive conversion-rate-optimization (CRO) analyst for an e-commerce funnel builder.',
    'Answer the user\'s question directly and concisely, in the same language the user writes in.',
  ];
  if (hasTools) {
    lines.push(
      'You can investigate funnel and order metrics, inspect page structure, and (when available) screenshot the tenant\'s own published pages using your tools.',
      'Use the tools to ground every claim in real data — call getFunnelList to see what exists, getFunnelMetrics for per-step drop-off, getOrders for revenue/refunds, getPageContent to inspect a page, and screenshotPage to look at a rendered page when it helps.',
      'Never invent numbers: if you have not read a value from a tool, do not state it.',
    );
  } else {
    lines.push(
      'NOTE: data tools are unavailable for this model, so you cannot query live metrics. Give general CRO guidance based only on what the user tells you, and never fabricate specific numbers or claim to have inspected real data.',
    );
  }
  if (funnelId) {
    lines.push(`The funnel currently in context is "${funnelId}". Start your investigation there unless the user asks about something else.`);
  }
  lines.push('Be practical: surface the likely bottleneck and give a short, prioritized list of concrete recommendations.');
  return lines.join(' ');
}

export const POST: APIRoute = async ({ request }) => {
  await requireFeature('ANALYTICS');

  let body: AnalystChatRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { messages, funnelId, modelName } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return jsonError('Missing or empty messages array', 400);
  }

  let resolved;
  try {
    resolved = await resolveLlmModel(modelName);
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) return jsonError(error.message, 412, error.code);
    logger.error('Failed to resolve LLM provider', { error });
    return jsonError('Failed to resolve LLM configuration', 500);
  }

  const useTools = resolved.protocol === 'anthropic';
  let tools: Record<string, unknown> | undefined;
  if (useTools) {
    try {
      tools = createAnalystTools(await buildAnalystDeps()).tools;
    } catch (error) {
      logger.error('Failed to build analyst tools', { error });
      tools = undefined;
    }
  }

  const system = buildAnalystSystemPrompt(funnelId, !!tools);

  const modelMessages: ModelMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.text,
  }));

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
        const result = await runAnalystAgent({
          model: resolved.model,
          system,
          messages: modelMessages,
          tools,
          maxSteps: 20,
          onEvent: (event) => send(event),
        });

        send({ type: 'done', explanation: result.text?.trim() || 'Done.' });
      } catch (error) {
        logger.error('Analyst agent generation failed', { error });
        send({ type: 'error', error: error instanceof Error ? error.message : 'AI analysis failed' });
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
