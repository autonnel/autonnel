import type { APIContext } from 'astro';
import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeIdentity } from '@/composition/make-identity';
import { resolveIdentityDeps } from '@/composition/identity-deps';
import type { RoleDto } from '@/contracts/identity';
import type { RoleView } from '@/modules/identity/application/ports/inbound';

function toDto(r: RoleView): RoleDto {
  return { id: r.id, name: r.name, description: r.description, isSystem: r.isSystem, features: r.grants };
}

export const GET = defineRoute('GET /api/permissions/roles', { feature: 'PERMISSIONS' }, async ({ locals, request }) => {
  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  const roles = (await identity.roleDashboard.listRoles()).map(toDto);
  return { roles };
});

export const POST = defineRoute('POST /api/permissions/roles', { feature: 'PERMISSIONS', status: 201 }, async ({ input, locals, request }) => {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  if (!name) throw new ApiError(400, 'name is required');
  if (name.length > 50) throw new ApiError(400, 'name too long');
  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  const created = await identity.roleDashboard.createRole({ name, description: input?.description ?? null });
  return { role: toDto(created) };
});
