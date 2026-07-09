import type { APIContext } from 'astro';
import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeIdentity } from '@/composition/make-identity';
import { getTenantId } from '@/modules/identity/application/principal-resolution';
import { resolveIdentityDeps } from '@/composition/identity-deps';

export const PUT = defineRoute('PUT /api/permissions/users/:userId/roles', { feature: 'PERMISSIONS' }, async ({ input, params, locals, request }) => {
  const userId = params.userId as string;
  if (!Array.isArray(input?.roleIds)) throw new ApiError(400, 'roleIds must be an array');
  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  await identity.membershipDashboard.assignRoles({ userId, tenantId: getTenantId(), roleIds: input.roleIds });
  return { success: true as const, userId, roleIds: input.roleIds };
});
