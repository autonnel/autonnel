import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeAuthoring } from '@/composition/make-authoring';
import { authoringDepsFromLocals } from '@/composition/authoring-runtime';
import { AiChatSessionError } from '@/modules/authoring/application/ai-chat-session-service';
import { toChatSessionDto } from './index';

export const GET = defineRoute('GET /api/page/:pageId/chat-sessions/:sessionId', { feature: 'PAGES' }, async ({ params, locals }) => {
  if (!params.pageId || !params.sessionId) throw new ApiError(400, 'Missing pageId or sessionId');
  const authoring = makeAuthoring(authoringDepsFromLocals(locals));
  try {
    return { session: toChatSessionDto(await authoring.aiChatSessions.get(params.pageId, params.sessionId)) };
  } catch (err) {
    if (err instanceof AiChatSessionError) throw new ApiError(err.status, err.message);
    throw err;
  }
});

export const PUT = defineRoute('PUT /api/page/:pageId/chat-sessions/:sessionId', { feature: 'PAGES' }, async ({ input, params, locals }) => {
  if (!params.pageId || !params.sessionId) throw new ApiError(400, 'Missing pageId or sessionId');
  const authoring = makeAuthoring(authoringDepsFromLocals(locals));
  try {
    const session = await authoring.aiChatSessions.update(params.pageId, params.sessionId, input ?? {});
    return { session: toChatSessionDto(session) };
  } catch (err) {
    if (err instanceof AiChatSessionError) throw new ApiError(err.status, err.message);
    throw err;
  }
});

export const DELETE = defineRoute('DELETE /api/page/:pageId/chat-sessions/:sessionId', { feature: 'PAGES' }, async ({ params, locals }) => {
  if (!params.pageId || !params.sessionId) throw new ApiError(400, 'Missing pageId or sessionId');
  const authoring = makeAuthoring(authoringDepsFromLocals(locals));
  try {
    await authoring.aiChatSessions.delete(params.pageId, params.sessionId);
    return { ok: true } as const;
  } catch (err) {
    if (err instanceof AiChatSessionError) throw new ApiError(err.status, err.message);
    throw err;
  }
});
