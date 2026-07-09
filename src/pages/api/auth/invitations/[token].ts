import type { APIContext } from 'astro';
import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeIdentity } from '@/composition/make-identity';
import { getPrincipal } from '@/modules/identity/application/principal-resolution';
import { isUserPrincipal } from '@/modules/shared-kernel/principal';
import { resolveIdentityDeps } from '@/composition/identity-deps';

// The `token` segment carries the plaintext invitation token for POST (accept) and the invitation id for DELETE (revoke).
export const POST = defineRoute('POST /api/auth/invitations/:token', {}, async ({ input, params, locals, request }) => {
  const principal = getPrincipal();
  if (!principal || !isUserPrincipal(principal)) throw new ApiError(401, 'Unauthorized');

  const token = params.token;
  if (!token) throw new ApiError(400, 'Missing invitation token');
  const email = typeof input?.email === 'string' ? input.email.trim() : '';
  if (!email) throw new ApiError(400, 'email required');

  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  await identity.invitations.accept({
    plaintextToken: token,
    acceptingUserId: principal.userId,
    acceptingEmail: email,
  });
  return { ok: true as const };
});

export const DELETE = defineRoute('DELETE /api/auth/invitations/:id', { feature: 'SETTINGS_USERS' }, async ({ params, locals, request }) => {
  const id = params.token;
  if (!id) throw new ApiError(400, 'Missing invitation id');
  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  await identity.invitations.revoke(id);
  return { ok: true as const };
});
