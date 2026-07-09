import type { APIContext } from 'astro';
import { defineRoute } from '@/lib/api/define-route';
import { makeIdentity } from '@/composition/make-identity';
import { FEATURES } from '@/modules/identity/infra/feature-catalog';
import { resolveIdentityDeps } from '@/composition/identity-deps';
import type { FeatureCatalogEntry, MemberDto } from '@/contracts/identity';

export const GET = defineRoute('GET /api/permissions', { feature: 'PERMISSIONS' }, async ({ locals, request }) => {
  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  const members = await identity.memberDirectory.listMembers();
  const features: FeatureCatalogEntry[] = FEATURES.map((id) => ({ id, label: id, group: '' }));
  const users: MemberDto[] = members.map((m) => ({
    id: m.id,
    email: m.email,
    name: m.name,
    avatar: m.avatar,
    roles: m.roles,
  }));
  return { features, users };
});
