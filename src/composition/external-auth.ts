import type { APIContext } from 'astro';
import { makeIdentity } from './make-identity';
import { resolveIdentityDeps } from './identity-deps';
import { runWithContext } from '@/lib/tenant/context';
import { ForbiddenError } from '@/modules/identity/published/principal';
import type { ApiClientPrincipal } from '@/modules/shared-kernel/principal';

export class WriteAccessDeniedError extends Error {
  constructor() {
    super('Write access is not enabled for this API key');
    this.name = 'WriteAccessDeniedError';
  }
}

// Mutating external routes need BOTH the coarse writeAccess flag and the specific feature grant.
export function requireWriteAccess(principal: ApiClientPrincipal): void {
  if (!principal.writeAccess) throw new WriteAccessDeniedError();
}

const WRITE_DENIED = {
  error: {
    message: 'Write access is not enabled for this API key. Enable it in API Settings.',
    type: 'permission_error',
    code: 'write_access_denied',
  },
} as const;

export async function withApiPrincipal<T>(
  context: APIContext,
  fn: (principal: ApiClientPrincipal) => Promise<T>,
): Promise<T | Response> {
  const identity = makeIdentity(resolveIdentityDeps(context));
  const header = context.request.headers.get('authorization');
  const principal = await identity.apiAuth.authenticate(header);
  if (!principal) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  return runWithContext({ tenantId: principal.tenantId, principal }, async () => {
    try {
      return await fn(principal);
    } catch (err) {
      if (err instanceof WriteAccessDeniedError) {
        return new Response(JSON.stringify(WRITE_DENIED), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (err instanceof ForbiddenError) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
      }
      throw err;
    }
  });
}
