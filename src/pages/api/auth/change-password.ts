import type { APIContext } from 'astro';
import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeIdentity } from '@/composition/make-identity';
import { resolveIdentityDeps, readSessionCookie } from '@/composition/identity-deps';
import { InvalidCurrentPasswordError } from '@/modules/identity/application/change-password-service';

export const POST = defineRoute('POST /api/auth/change-password', {}, async ({ input, locals, request }) => {
  const token = readSessionCookie(request);
  if (!token) throw new ApiError(401, 'Not authenticated');

  const currentPassword = typeof input?.currentPassword === 'string' ? input.currentPassword : '';
  const newPassword = typeof input?.newPassword === 'string' ? input.newPassword : '';
  if (!currentPassword || !newPassword) throw new ApiError(400, 'Invalid request body');

  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  try {
    const result = await identity.changePassword.change({
      currentSessionToken: token,
      currentPassword,
      newPassword,
    });
    return { ok: true as const, sessionsRevoked: result.sessionsRevoked };
  } catch (err) {
    if (err instanceof InvalidCurrentPasswordError) throw new ApiError(400, err.message);
    if (err instanceof Error && err.message === 'Not authenticated') throw new ApiError(401, 'Not authenticated');
    throw err;
  }
});
