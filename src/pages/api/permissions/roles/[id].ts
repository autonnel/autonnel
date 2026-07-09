import type { APIContext } from 'astro';
import { defineRoute } from '@/lib/api/define-route';
import { makeIdentity } from '@/composition/make-identity';
import { resolveIdentityDeps } from '@/composition/identity-deps';
import type { RoleDto } from '@/contracts/identity';
import type { RoleView } from '@/modules/identity/application/ports/inbound';

function toDto(r: RoleView): RoleDto {
  return { id: r.id, name: r.name, description: r.description, isSystem: r.isSystem, features: r.grants };
}

export const PUT = defineRoute('PUT /api/permissions/roles/:id', { feature: 'PERMISSIONS' }, async ({ input, params, locals, request }) => {
  const id = params.id as string;
  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  const role = await identity.roleDashboard.updateRole(id, {
    ...(input?.name !== undefined ? { name: typeof input.name === 'string' ? input.name.trim() : input.name } : {}),
    ...(input?.description !== undefined ? { description: input.description } : {}),
  });
  return { role: toDto(role) };
});

export const DELETE = defineRoute('DELETE /api/permissions/roles/:id', { feature: 'PERMISSIONS' }, async ({ params, locals, request }) => {
  const id = params.id as string;
  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  await identity.roleDashboard.deleteRole(id);
  return { success: true as const };
});
