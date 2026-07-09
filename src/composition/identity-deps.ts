import type { APIContext } from 'astro';
import type { IdentityDeps } from './make-identity';
import { getBasePrisma } from '@/lib/db';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { getRuntimeEnv } from '@/lib/runtime/env';
import { resolveSessionSecret } from '@/lib/services/session-secret';

export function resolveIdentityDeps(_context: APIContext): IdentityDeps {
  const env = getRuntimeEnv();
  return {
    rawPrisma: getBasePrisma(),
    scopedPrisma: getTenantPrisma(),
    sessionSecret: resolveSessionSecret('AUTH_SESSION_SECRET', env),
  };
}

export const SESSION_COOKIE = 'autonnel_session';
const SESSION_MAX_AGE = 604800;

export function readSessionCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)autonnel_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// `Secure` is only emitted over HTTPS; hardcoding it drops the cookie on plain-http dev
// access (any host other than localhost), which silently bounces the user back to /login.
function isSecureRequest(context: APIContext): boolean {
  const proto = context.request.headers.get('x-forwarded-proto');
  if (proto) return proto.split(',')[0].trim() === 'https';
  const url = context.url ?? new URL(context.request.url);
  return url.protocol === 'https:';
}

function serializeSessionCookie(context: APIContext, token: string, maxAge: number): string {
  const parts = [`${SESSION_COOKIE}=${token}`, 'HttpOnly'];
  if (isSecureRequest(context)) parts.push('Secure');
  parts.push('SameSite=Lax', 'Path=/', `Max-Age=${maxAge}`);
  return parts.join('; ');
}

export function sessionCookie(context: APIContext, token: string): string {
  return serializeSessionCookie(context, token, SESSION_MAX_AGE);
}

export function clearedSessionCookie(context: APIContext): string {
  return serializeSessionCookie(context, '', 0);
}

export function jsonResponse(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
