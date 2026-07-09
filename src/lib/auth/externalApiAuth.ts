import type { APIContext } from 'astro';
import { validateApiToken, createUnauthorizedResponse } from './apiAuth';

export interface ExternalAuthResult {
  authenticated: true;
  userId?: string;
  writeAccess?: boolean;
}

const CONTENT_TYPE_JSON = { 'Content-Type': 'application/json' } as const;

function send(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: CONTENT_TYPE_JSON });
}

const WRITE_DENIED = {
  error: {
    message: 'Write access is not enabled for this API key. Enable it in API Settings.',
    type: 'permission_error',
    code: 'write_access_denied',
  },
} as const;

export async function authenticateExternalApi(
  context: APIContext,
): Promise<ExternalAuthResult | Response> {
  const token = context.request.headers.get('Authorization');
  const check = await validateApiToken(token);

  if (check.valid) {
    return {
      authenticated: true,
      userId: check.userId,
      writeAccess: check.writeAccess,
    };
  }

  return createUnauthorizedResponse(check.error || 'Invalid token');
}

export function requireWriteAccess(auth: ExternalAuthResult): Response | null {
  if (auth.writeAccess) return null;
  return send(WRITE_DENIED, 403);
}

export function jsonError(message: string, status: number): Response {
  return send({ error: { message, type: 'api_error' } }, status);
}

export function jsonResponse(data: unknown, status = 200): Response {
  return send(data, status);
}
