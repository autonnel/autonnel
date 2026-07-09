import { ApiClientCredential, ApiKeyStatus } from '../../domain/api-client-credential';
import { PermissionSet } from '../../domain/permission-set';
import { isFeatureKey, type FeatureKey } from '../../domain/feature-key';
import type { ApiKeyRepositoryPort } from '../../application/ports/outbound';

interface ApiKeyRow {
  id: string; tenantId: string; name: string | null; prefix: string; status: string;
  scope: string[]; writeAccess: boolean; expiresAt: Date | null; createdAt: Date | null;
}

type RawClient = { apiKey: { findFirst: Function } };
type ScopedClient = { apiKey: { findMany: Function; upsert: Function } };

// findByHashGlobal uses the RAW (un-scoped) client: a Bearer key is resolved before any tenant context exists.
export class PrismaApiKeyRepository implements ApiKeyRepositoryPort {
  constructor(private readonly raw: RawClient, private readonly scoped: ScopedClient) {}

  async findByHashGlobal(keyHash: string): Promise<{ credential: ApiClientCredential; tenantId: string } | null> {
    const row = (await this.raw.apiKey.findFirst({ where: { keyHash } })) as ApiKeyRow | null;
    if (!row) return null;
    return { credential: toApiKeyAggregate(row), tenantId: row.tenantId };
  }

  async listByTenant(): Promise<ApiClientCredential[]> {
    const rows = (await this.scoped.apiKey.findMany({})) as ApiKeyRow[];
    return rows.map(toApiKeyAggregate);
  }

  async save(credential: ApiClientCredential, keyHash: string): Promise<void> {
    const s = credential.snapshot();
    await this.scoped.apiKey.upsert({
      where: { id: s.id },
      create: {
        id: s.id, name: s.name, prefix: s.prefix, keyHash, status: s.status,
        scope: s.scope.toArray().map(String), writeAccess: s.writeAccess, expiresAt: s.expiresAt,
      } as never,
      update: { status: s.status, writeAccess: s.writeAccess, expiresAt: s.expiresAt } as never,
    });
  }
}

function toApiKeyAggregate(row: ApiKeyRow): ApiClientCredential {
  const keys = row.scope.filter(isFeatureKey) as FeatureKey[];
  return ApiClientCredential.rehydrate({
    id: row.id, name: row.name ?? null, prefix: row.prefix,
    status: row.status === 'revoked' ? ApiKeyStatus.Revoked : ApiKeyStatus.Active,
    scope: PermissionSet.of(keys), writeAccess: row.writeAccess, expiresAt: row.expiresAt,
    createdAt: row.createdAt ?? null,
  });
}
