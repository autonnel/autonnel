import { defineRoute, ApiError } from '@/lib/api/define-route';
import { getPermissionRepository } from '@/lib/rbac/repository';

// setUserRoles maps the virtual admin id to the tenant's real Admin role; writing it raw would strip all access.
export const PUT = defineRoute('PUT /api/permissions/users/:userId/roles', { feature: 'PERMISSIONS' }, async ({ input, params }) => {
  const userId = params.userId as string;
  if (!Array.isArray(input?.roleIds)) throw new ApiError(400, 'roleIds must be an array');
  await getPermissionRepository().setUserRoles(userId, input.roleIds);
  return { success: true as const, userId, roleIds: input.roleIds };
});
