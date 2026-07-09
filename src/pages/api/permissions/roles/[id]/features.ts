import type { APIContext } from 'astro';
import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeIdentity } from '@/composition/make-identity';
import { resolveIdentityDeps } from '@/composition/identity-deps';

export const PUT = defineRoute('PUT /api/permissions/roles/:id/features', { feature: 'PERMISSIONS' }, async ({ input, params, locals, request }) => {
  const id = params.id as string;
  if (!Array.isArray(input?.featureIds)) throw new ApiError(400, 'featureIds must be an array');
  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  const role = await identity.roleDashboard.setRoleFeatures(id, input.featureIds);
  return { success: true as const, roleId: id, features: role.grants };
});
