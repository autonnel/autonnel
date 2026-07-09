import type { APIRoute } from 'astro';
import { authenticateExternalApi, jsonError, jsonResponse } from '@/lib/auth/externalApiAuth';
import { makeMessaging } from '@/composition/make-messaging';
import { ForbiddenError } from '@/modules/identity/published/principal';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ExternalTemplates');

export const GET: APIRoute = async (context) => {
  const auth = await authenticateExternalApi(context);
  if (auth instanceof Response) return auth;

  try {
    const list = await makeMessaging().manageTemplate.listTemplates();
    return jsonResponse({ templates: list });
  } catch (error) {
    if (error instanceof ForbiddenError) return jsonError('Forbidden', 403);
    logger.error('List templates error', { error });
    return jsonError('Failed to list templates', 500);
  }
};
