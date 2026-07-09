import type { APIContext, APIRoute } from 'astro';
import { requireFeature, ForbiddenError } from '@/modules/identity/application/principal-resolution';
import { toFeatureKey } from '@/modules/identity/domain/feature-key';
import type { ApiKey, ApiInput, ApiOutput } from '@/contracts';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api');

export interface RouteCtx<K extends ApiKey> {
  /** Parsed JSON body for non-GET methods (null otherwise / on parse failure). */
  input: ApiInput<K>;
  query: URLSearchParams;
  params: APIContext['params'];
  locals: APIContext['locals'];
  request: Request;
}

export interface RouteOpts {
  /** FEATURES key to gate on (403 if the principal lacks it). Omit for public routes. */
  feature?: string;
  /** HTTP status for the success response (default 200). */
  status?: number;
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function defineRoute<K extends ApiKey>(
  key: K,
  opts: RouteOpts,
  handler: (ctx: RouteCtx<K>) => Promise<ApiOutput<K>>,
): APIRoute {
  const method = key.slice(0, key.indexOf(' '));
  return async ({ request, params, locals }) => {
    try {
      if (opts.feature) requireFeature(toFeatureKey(opts.feature));
      let input: unknown = null;
      if (method !== 'GET' && method !== 'DELETE') {
        const ct = request.headers.get('content-type') ?? '';
        if (ct.includes('application/json')) input = await request.json().catch(() => null);
      }
      const url = new URL(request.url);
      const output = await handler({
        input: input as ApiInput<K>,
        query: url.searchParams,
        params,
        locals,
        request,
      });
      return new Response(JSON.stringify(output), {
        status: opts.status ?? 200,
        headers: { 'content-type': 'application/json' },
      });
    } catch (err) {
      if (err instanceof ForbiddenError) return errJson(403, 'Forbidden');
      if (err instanceof ApiError) return errJson(err.status, err.message);
      // Unexpected errors: log the detail server-side, return a generic message so
      // internal (e.g. Prisma) error text never leaks to callers. Client-facing
      // validation errors must be raised as ApiError to surface a specific message.
      logger.error('Unhandled route error', { key, error: err });
      return errJson(500, 'Internal error');
    }
  };
}

function errJson(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
