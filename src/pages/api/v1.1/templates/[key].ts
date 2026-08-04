import type { APIContext } from 'astro';
import { jsonError, jsonResponse } from '@/lib/auth/externalApiAuth';
import { ForbiddenError, requireFeature } from '@/modules/identity/published/principal';
import { withApiPrincipal } from '@/composition/external-auth';
import { makeMessaging } from '@/composition/make-messaging';
import { createLogger } from '@/lib/logger';

const log = createLogger('ExternalTemplateDetail');

export function GET(context: APIContext): Promise<Response> {
  return withApiPrincipal(context, async () => {
    requireFeature('SETTINGS_EMAIL');

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
      // withApiPrincipal owns the 403 mapping; rethrow so a service-level denial is not
      // flattened into a generic 500 here.
      if (error instanceof ForbiddenError) throw error;
      log.error('Template detail error', { error, key });
      return jsonError('Failed to get template', 500);
    }
  }) as Promise<Response>;
}
