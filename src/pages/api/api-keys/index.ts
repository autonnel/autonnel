import type { APIContext } from 'astro';
import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeIdentity } from '@/composition/make-identity';
import { isFeatureKey, toFeatureKey } from '@/modules/identity/domain/feature-key';
import { PermissionSet } from '@/modules/identity/domain/permission-set';
import { FEATURES as FEATURE_CATALOG } from '@/modules/identity/infra/feature-catalog';
import { resolveIdentityDeps } from '@/composition/identity-deps';
import type { ApiKeyDto } from '@/contracts/identity';

function maskKey(prefix: string): string {
  if (!prefix) return '';
  if (prefix.length <= 10) return prefix;
  return `${prefix.slice(0, 6)}…${prefix.slice(-4)}`;
}

export const GET = defineRoute('GET /api/api-keys', { feature: 'API_KEYS' }, async ({ locals, request }) => {
  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  const rows = await identity.apiKeys.list();
  const apiKeys: ApiKeyDto[] = rows.map((k) => ({
    id: k.id,
    name: k.name ?? 'Default',
    key: maskKey(k.prefix),
    writeAccess: k.writeAccess,
    isActive: k.isActive,
    expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
    createdAt: (k.createdAt ?? new Date()).toISOString(),
  }));
  return { apiKeys };
});

export const POST = defineRoute('POST /api/api-keys', { feature: 'API_KEYS', status: 201 }, async ({ input, locals, request }) => {
  // No explicit grants (the dashboard form sends none) ⇒ full API scope; writeAccess still gates mutations.
  const explicitGrants = Array.isArray(input?.grants) ? input!.grants.filter(isFeatureKey).map(toFeatureKey) : null;
  const scope = PermissionSet.of(explicitGrants ?? FEATURE_CATALOG.map(toFeatureKey));
  const expiresAt = input?.expiresAt ? new Date(input.expiresAt) : null;
  const name = typeof input?.name === 'string' && input.name.trim().length > 0 ? input.name.trim() : null;
  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  // Plaintext is returned exactly once; only the hash is ever persisted.
  const issued = await identity.apiKeys.issue({ name, scope, writeAccess: input?.writeAccess === true, expiresAt });
  return { key: issued.plaintext };
});

export const PATCH = defineRoute('PATCH /api/api-keys', { feature: 'API_KEYS' }, async ({ input, locals, request }) => {
  if (!input?.id) throw new ApiError(400, 'Missing key id');
  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  await identity.apiKeys.setWriteAccess(input.id, input.writeAccess === true);
  return { ok: true } as const;
});

export const DELETE = defineRoute('DELETE /api/api-keys', { feature: 'API_KEYS' }, async ({ query, locals, request }) => {
  const id = query.get('id');
  if (!id) throw new ApiError(400, 'Missing key id');
  const identity = makeIdentity(resolveIdentityDeps({ locals, request } as APIContext));
  await identity.apiKeys.revoke(id);
  return { ok: true } as const;
});
