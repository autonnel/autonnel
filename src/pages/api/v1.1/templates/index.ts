import type { APIRoute } from 'astro';
import { jsonError, jsonResponse } from '@/lib/auth/externalApiAuth';
import { ForbiddenError, requireFeature } from '@/modules/identity/published/principal';
import { withApiPrincipal } from '@/composition/external-auth';
import { makeMessaging } from '@/composition/make-messaging';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ExternalTemplates');

export const GET: APIRoute = (context) =>
  withApiPrincipal(context, async () => {
    requireFeature('SETTINGS_EMAIL');
    try {
      const list = await makeMessaging().manageTemplate.listTemplates();
      return jsonResponse({ templates: list });
    } catch (error) {
      // withApiPrincipal owns the 403 mapping; rethrow so a service-level denial is not
      // flattened into a generic 500 here.
      if (error instanceof ForbiddenError) throw error;
      logger.error('List templates error', { error });
      return jsonError('Failed to list templates', 500);
    }
  });
