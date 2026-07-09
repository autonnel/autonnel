import type { APIRoute, APIContext } from 'astro';
import { checkAuth, type AuthUser, type AuthResult } from '@/lib/auth/middleware';
import {
  userHasFeature,
  canAccessPermissionsPageAsync,
  FEATURES,
  type FeatureId,
} from '@/lib/rbac';
import { createLogger } from '@/lib/logger';
import { readEnv } from '@/lib/runtime/env';
import { StorageNotConfiguredError } from '@/lib/s3';

const log = createLogger('APIHelpers');

const CONTENT_TYPE_JSON = { 'Content-Type': 'application/json' } as const;

export interface AuthContext {
  user: AuthUser;
  auth: AuthResult;
}

type AuthenticatedHandler = (
  context: APIContext,
  authCtx: AuthContext
) => Response | Promise<Response>;

type CronHandler = (context: APIContext) => Response | Promise<Response>;

function serialize(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: CONTENT_TYPE_JSON });
}

export function jsonResponse(data: unknown, status = 200): Response {
  return serialize(data, status);
}

export function jsonError(message: string, status: number): Response {
  return serialize({ error: message }, status);
}

function failureToResponse(error: unknown, label: string): Response {
  if (error instanceof StorageNotConfiguredError) {
    return jsonError(error.message, 412);
  }
  log.error(label, { error });
  return jsonError('Internal server error', 500);
}

async function isAuthorizedFor(user: AuthUser, feature: FeatureId): Promise<boolean> {
  if (await userHasFeature(user.id, feature)) {
    return true;
  }
  if (feature !== FEATURES.PERMISSIONS) {
    return false;
  }
  return canAccessPermissionsPageAsync(user.id, user.providerId);
}

export function withAuth(feature: FeatureId, handler: AuthenticatedHandler): APIRoute {
  return async (context) => {
    const auth = await checkAuth(context);
    const user = auth.user;
    if (!auth.authenticated || !user) {
      return jsonError('Unauthorized', 401);
    }

    if (!(await isAuthorizedFor(user, feature))) {
      return jsonError('Forbidden', 403);
    }

    try {
      return await handler(context, { user, auth });
    } catch (error) {
      return failureToResponse(error, 'API handler error');
    }
  };
}

function cronKeyMatches(context: APIContext): boolean {
  const expected = readEnv('CRON_KEY');
  if (!expected) {
    return false;
  }
  const provided = new URL(context.request.url).searchParams.get('key');
  return provided === expected;
}

export function withCronAuth(handler: CronHandler): APIRoute {
  return async (context) => {
    if (!cronKeyMatches(context)) {
      return jsonError('Unauthorized', 401);
    }

    try {
      return await handler(context);
    } catch (error) {
      log.error('Cron handler error', { error });
      return jsonError('Internal server error', 500);
    }
  };
}
