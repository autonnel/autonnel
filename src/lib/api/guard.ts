
import type { APIRoute, APIContext } from 'astro';
import { z, type ZodType } from 'zod';
import { checkAuth, type AuthUser } from '@/lib/auth/middleware';
import {
  userHasFeature,
  canAccessPermissionsPageAsync,
  FEATURES,
  type FeatureId,
} from '@/lib/rbac';
import { validateApiToken } from '@/lib/auth/apiAuth';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { createLogger } from '@/lib/logger';
import { readEnv } from '@/lib/runtime/env';
import { StorageNotConfiguredError } from '@/lib/s3';

const logger = createLogger('apiGuard');

export type AuthMode = 'session' | 'externalApi' | 'cron' | 'public';
export type TenantMode = 'required' | 'optional' | 'none';
export type ErrorType =
  | 'authentication_error'
  | 'permission_error'
  | 'validation_error'
  | 'api_error'
  | 'rate_limit_error';

export interface ApiKeyContext {
  userId: string;
  writeAccess: boolean;
}

type UserForAuth<A extends AuthMode> = A extends 'session'
  ? AuthUser
  : AuthUser | null;

type ApiKeyForAuth<A extends AuthMode> = A extends 'externalApi'
  ? ApiKeyContext
  : null;

export interface GuardCtx<A extends AuthMode, B = unknown, Q = unknown> {
  request: Request;
  params: Record<string, string | undefined>;
  url: URL;
  tenantId: string;
  user: UserForAuth<A>;
  apiKey: ApiKeyForAuth<A>;
  body: B;
  query: Q;
  raw: APIContext;
}

export interface GuardOptions<A extends AuthMode, B = unknown, Q = unknown> {
  auth: A;
  tenant?: TenantMode;

  feature?: FeatureId;

  writeAccess?: boolean;
  bodySchema?: ZodType<B>;
  querySchema?: ZodType<Q>;
}

interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    type: ErrorType;
    details?: unknown;
  };
}

export interface ApiErrorOptions {
  type?: ErrorType;
  details?: unknown;
  headers?: Record<string, string>;
}

function buildErrorResponse(
  code: string,
  message: string,
  status: number,
  opts: ApiErrorOptions = {},
): Response {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      type: opts.type ?? 'api_error',
    },
  };
  if (opts.details !== undefined) body.error.details = opts.details;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers ?? {}),
  };
  if (status === 401 && !headers['WWW-Authenticate']) {
    headers['WWW-Authenticate'] = 'Bearer';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export function json<T>(data: T, init?: number | ResponseInit): Response {
  let status = 200;
  let extraHeaders: HeadersInit | undefined;
  if (typeof init === 'number') {
    status = init;
  } else if (init) {
    status = init.status ?? 200;
    extraHeaders = init.headers;
  }
  const headers = new Headers(extraHeaders);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(data), { status, headers });
}

interface ApiErrorFn {
  (
    code: string,
    message: string,
    status?: number,
    opts?: ApiErrorOptions,
  ): Response;
  NOT_FOUND: (resource?: string) => Response;
  BAD_REQUEST: (message: string, details?: unknown) => Response;
  UNAUTHORIZED: (message?: string) => Response;
  FORBIDDEN: (message?: string) => Response;
  CONFLICT: (message: string) => Response;
  fromException: (err: unknown) => Response;
}

const apiErrorImpl = ((
  code: string,
  message: string,
  status = 400,
  opts?: ApiErrorOptions,
): Response => buildErrorResponse(code, message, status, opts)) as ApiErrorFn;

apiErrorImpl.NOT_FOUND = (resource = 'Resource') =>
  buildErrorResponse('not_found', `${resource} not found`, 404);

apiErrorImpl.BAD_REQUEST = (message: string, details?: unknown) =>
  buildErrorResponse('bad_request', message, 400, { details });

apiErrorImpl.UNAUTHORIZED = (message = 'Unauthorized') =>
  buildErrorResponse('unauthorized', message, 401, {
    type: 'authentication_error',
  });

apiErrorImpl.FORBIDDEN = (message = 'Forbidden') =>
  buildErrorResponse('forbidden', message, 403, { type: 'permission_error' });

apiErrorImpl.CONFLICT = (message: string) =>
  buildErrorResponse('conflict', message, 409);

function isProd(): boolean {
  const node = readEnv('NODE_ENV');
  return node === 'production';
}

apiErrorImpl.fromException = (err: unknown) => {
  const dev = !isProd();
  const message = err instanceof Error ? err.message : String(err);
  const details =
    dev && err instanceof Error
      ? { name: err.name, stack: err.stack }
      : undefined;
  logger.error('Unhandled API exception', { error: err });
  return buildErrorResponse(
    'internal_error',
    dev ? message : 'Internal server error',
    500,
    { details },
  );
};

export const apiError: ApiErrorFn = apiErrorImpl;

function defaultTenantMode(auth: AuthMode): TenantMode {
  if (auth === 'session' || auth === 'externalApi') return 'required';
  return 'none';
}

function getCronKey(): string | undefined {
  return readEnv('CRON_KEY');
}

async function readJsonBody(request: Request): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return undefined;
  try {
    return await request.json();
  } catch {
    return Symbol.for('autonnel.guard.invalid_json');
  }
}

const INVALID_JSON = Symbol.for('autonnel.guard.invalid_json');

export function apiGuard<A extends AuthMode, B = unknown, Q = unknown>(
  opts: GuardOptions<A, B, Q>,
  handler: (ctx: GuardCtx<A, B, Q>) => Response | Promise<Response>,
): APIRoute {
  const tenantMode = opts.tenant ?? defaultTenantMode(opts.auth);

  return async (context: APIContext) => {
    try {
      let user: AuthUser | null = null;
      let apiKey: ApiKeyContext | null = null;

      if (opts.auth === 'session') {
        const auth = await checkAuth(context);
        if (!auth.authenticated || !auth.user) {
          return apiError.UNAUTHORIZED();
        }
        user = auth.user;
        if (opts.feature) {
          const hasAccess = await userHasFeature(user.id, opts.feature);
          if (!hasAccess) {
            const isPermissionsEscape =
              opts.feature === FEATURES.PERMISSIONS &&
              (await canAccessPermissionsPageAsync(user.id, user.providerId));
            if (!isPermissionsEscape) return apiError.FORBIDDEN();
          }
        }
      } else if (opts.auth === 'externalApi') {
        const authHeader = context.request.headers.get('Authorization');
        const result = await validateApiToken(authHeader);
        if (!result.valid) {
          return apiError.UNAUTHORIZED(result.error || 'Invalid token');
        }
        apiKey = {
          userId: result.userId ?? '',
          writeAccess: !!result.writeAccess,
        };
        if (opts.writeAccess && !apiKey.writeAccess) {
          return buildErrorResponse(
            'write_access_denied',
            'Write access is not enabled for this API key. Enable it in API Settings.',
            403,
            { type: 'permission_error' },
          );
        }
      } else if (opts.auth === 'cron') {
        const expected = getCronKey();
        const key = new URL(context.request.url).searchParams.get('key');
        if (!expected || !key || key !== expected) return apiError.UNAUTHORIZED();
      }

      let tenantId = '';
      if (tenantMode !== 'none') {
        tenantId = getCurrentTenantId();
        if (!tenantId && tenantMode === 'required') {
          return buildErrorResponse(
            'tenant_unresolved',
            'Tenant could not be resolved for this request.',
            500,
          );
        }
      }

      let body: B = undefined as unknown as B;
      if (opts.bodySchema) {
        const raw = await readJsonBody(context.request);
        if (raw === INVALID_JSON) {
          return buildErrorResponse(
            'invalid_json',
            'Request body is not valid JSON.',
            400,
          );
        }
        const parsed = opts.bodySchema.safeParse(raw);
        if (!parsed.success) {
          return buildErrorResponse(
            'validation_error',
            'Request body failed validation.',
            422,
            { type: 'validation_error', details: parsed.error.issues },
          );
        }
        body = parsed.data;
      }

      const url = new URL(context.request.url);
      let query: Q = undefined as unknown as Q;
      if (opts.querySchema) {
        const obj: Record<string, string> = {};
        url.searchParams.forEach((v, k) => {
          obj[k] = v;
        });
        const parsed = opts.querySchema.safeParse(obj);
        if (!parsed.success) {
          return buildErrorResponse(
            'validation_error',
            'Query parameters failed validation.',
            422,
            { type: 'validation_error', details: parsed.error.issues },
          );
        }
        query = parsed.data;
      }

      const ctx: GuardCtx<A, B, Q> = {
        request: context.request,
        params: context.params as Record<string, string | undefined>,
        url,
        tenantId,
        user: user as UserForAuth<A>,
        apiKey: apiKey as ApiKeyForAuth<A>,
        body,
        query,
        raw: context,
      };

      return await handler(ctx);
    } catch (err) {
      if (err instanceof StorageNotConfiguredError) {
        return buildErrorResponse('storage_not_configured', err.message, 412);
      }
      return apiError.fromException(err);
    }
  };
}

export { z };
