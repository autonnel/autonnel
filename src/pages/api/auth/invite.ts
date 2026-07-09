import type { APIContext } from 'astro';
import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeIdentity } from '@/composition/make-identity';
import { resolveIdentityDeps } from '@/composition/identity-deps';

export const POST = defineRoute('POST /api/auth/invite', { feature: 'SETTINGS_USERS', status: 201 }, async ({ input, locals, request }) => {
  const email = typeof input?.email === 'string' ? input.email.trim() : '';
  const roleName = typeof input?.role === 'string' ? input.role.trim() : '';
  if (!email) throw new ApiError(400, 'email required');

  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  const roles = await identity.roleDashboard.listRoles();
  const matched = roleName ? roles.find((r) => r.name === roleName) : null;
  const invitedRoleIds = matched ? [matched.id] : [];

  const result = await identity.invitations.create({ email, invitedRoleIds });
  return { id: result.id };
});
