import type { APIContext } from 'astro';
import { defineRoute } from '@/lib/api/define-route';
import { makeIdentity } from '@/composition/make-identity';
import { resolveIdentityDeps } from '@/composition/identity-deps';
import type { InvitationDto } from '@/contracts/identity';

export const GET = defineRoute('GET /api/auth/invitations', { feature: 'SETTINGS_USERS' }, async ({ locals, request }) => {
  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  const [rows, roles] = await Promise.all([identity.invitations.list(), identity.roleDashboard.listRoles()]);
  const roleNameById = new Map(roles.map((r) => [r.id, r.name] as const));
  const invitations: InvitationDto[] = rows.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.invitedRoleIds.map((id) => roleNameById.get(id) ?? id).join(', '),
    // Tokens are stored hashed; the raw token is shown only at creation time.
    token: '',
    expiresAt: inv.expiresAt.toISOString(),
    acceptedAt: inv.acceptedAt ? inv.acceptedAt.toISOString() : null,
    createdAt: inv.createdAt.toISOString(),
  }));
  return { invitations };
});
