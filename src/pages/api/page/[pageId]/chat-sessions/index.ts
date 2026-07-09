import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeAuthoring } from '@/composition/make-authoring';
import { authoringDepsFromLocals } from '@/composition/authoring-runtime';
import { AiChatSessionError, type ChatSession } from '@/modules/authoring/application/ai-chat-session-service';
import type { ChatSessionDto } from '@/contracts/pages';

export function toChatSessionDto(s: ChatSession): ChatSessionDto {
  return {
    id: s.id,
    title: s.title,
    messages: s.messages,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export const GET = defineRoute('GET /api/page/:pageId/chat-sessions', { feature: 'PAGES' }, async ({ params, locals }) => {
  if (!params.pageId) throw new ApiError(400, 'Missing pageId');
  const authoring = makeAuthoring(authoringDepsFromLocals(locals));
  const sessions = await authoring.aiChatSessions.list(params.pageId);
  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      messageCount: s.messageCount,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  };
});

export const POST = defineRoute('POST /api/page/:pageId/chat-sessions', { feature: 'PAGES' }, async ({ input, params, locals }) => {
  if (!params.pageId) throw new ApiError(400, 'Missing pageId');
  const authoring = makeAuthoring(authoringDepsFromLocals(locals));
  try {
    const session = await authoring.aiChatSessions.create(params.pageId, input ?? {});
    return { session: toChatSessionDto(session) };
  } catch (err) {
    if (err instanceof AiChatSessionError) throw new ApiError(err.status, err.message);
    throw err;
  }
});
