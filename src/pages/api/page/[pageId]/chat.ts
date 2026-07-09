import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { LlmNotConfiguredError } from '@/lib/llm/errors';
import { createPageBuilderAgent, type PageBuilderMessage } from '@/lib/ai/page-builder-agent';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

export const POST: APIRoute = async ({ params, request }) => {
  await requireFeature('PAGES');
  const { pageId } = params;
  if (!pageId) return jsonError('Missing pageId', 400);

  const body = (await request.json()) as {
    message: string;
    currentComponents?: Array<{ type: string; index: number }>;
    history?: PageBuilderMessage[];
  };

  const { message, currentComponents = [], history = [] } = body;
  if (!message?.trim()) return jsonError('Missing message', 400);

  const db = getTenantPrisma();
  const page = await db.page.findFirst({ where: { id: pageId }, select: { id: true, name: true, settings: true } });
  if (!page) return jsonError('Page not found', 404);

  const pagePrompt = page.name || 'E-commerce product page';

  let agent: Awaited<ReturnType<typeof createPageBuilderAgent>>;
  try {
    agent = await createPageBuilderAgent(pagePrompt, currentComponents);
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return jsonResponse({ error: err.message, code: err.code }, 412);
    }
    throw err;
  }

  const messages = [
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];

  const result = await agent.generate(messages);

  const actions = (result.toolCalls ?? []).map((tc) => ({
    tool: tc.payload.toolName,
    input: tc.payload.args,
  }));

  return jsonResponse({
    reply: result.text || (actions.length > 0 ? 'Done! The page has been updated.' : 'No changes made.'),
    actions,
  });
};
