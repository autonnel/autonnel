import type { APIContext } from 'astro';
import {
  authenticateExternalApi,
  jsonError,
  jsonResponse,
} from '@/lib/auth/externalApiAuth';
import { makeMessaging } from '@/composition/make-messaging';
import { ForbiddenError } from '@/modules/identity/published/principal';
import { createLogger } from '@/lib/logger';

const log = createLogger('ExternalTemplateDetail');

export async function GET(context: APIContext): Promise<Response> {
  const auth = await authenticateExternalApi(context);
  if (auth instanceof Response) {
    return auth;
  }

  const key = context.params.key;
  if (!key) {
    return jsonError('Template key is required', 400);
  }

  try {
    const template = await makeMessaging().manageTemplate.getTemplate(key);
    if (!template) {
      return jsonError('Template not found', 404);
    }
    return jsonResponse(template);
  } catch (error) {
    if (error instanceof ForbiddenError) return jsonError('Forbidden', 403);
    log.error('Template detail error', { error, key });
    return jsonError('Failed to get template', 500);
  }
}
