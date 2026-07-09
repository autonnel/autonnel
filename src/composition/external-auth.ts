import type { APIContext } from 'astro';
import { makeIdentity } from './make-identity';
import { resolveIdentityDeps } from './identity-deps';
import { runWithContext } from '@/lib/tenant/context';
import { ForbiddenError } from '@/modules/identity/published/principal';
import type { ApiClientPrincipal } from '@/modules/shared-kernel/principal';

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
      if (err instanceof ForbiddenError) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
      }
      throw err;
    }
  });
}
