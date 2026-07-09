import { ApiClientCredential, ApiKeyStatus } from '../domain/api-client-credential';
import { PermissionSet } from '../domain/permission-set';
import type { ApiKeyRepositoryPort, SecretGeneratorPort, DomainEventPublisherPort, ClockPort } from './ports/outbound';

export interface IssueApiKeyResult { id: string; prefix: string; plaintext: string; }
export interface ApiKeySummary {
  id: string;
  name: string | null;
  prefix: string;
  writeAccess: boolean;
  isActive: boolean;
  expiresAt: Date | null;
  createdAt: Date | null;
}

export class ApiKeyService {
  constructor(
    private readonly apiKeys: ApiKeyRepositoryPort,
    private readonly secrets: SecretGeneratorPort,
    private readonly events: DomainEventPublisherPort,
    private readonly clock: ClockPort,
  ) {}

  async list(): Promise<ApiKeySummary[]> {
    const now = this.clock.now();
    const all = await this.apiKeys.listByTenant();
    return all.map((c) => ({
      id: c.id,
      name: c.name,
      prefix: c.prefix,
      writeAccess: c.writeAccess,
      isActive: c.isActive(now),
      expiresAt: c.expiresAt,
      createdAt: c.createdAt,
    }));
  }

  async issue(input: { name?: string | null; scope: PermissionSet; writeAccess: boolean; expiresAt?: Date | null }): Promise<IssueApiKeyResult> {
    const plaintext = this.secrets.generatePlaintext();
    const keyHash = await this.secrets.hashSecret(plaintext);
    const prefix = plaintext.slice(0, 10);
    const credential = ApiClientCredential.rehydrate({
      id: crypto.randomUUID(), name: input.name ?? null, prefix, status: ApiKeyStatus.Active,
      scope: input.scope, writeAccess: input.writeAccess, expiresAt: input.expiresAt ?? null,
      createdAt: this.clock.now(),
    });
    await this.apiKeys.save(credential, keyHash);
    await this.events.publish({ type: 'ApiKeyIssued', payload: { apiKeyId: credential.id } });
    return { id: credential.id, prefix, plaintext };
  }

  async setWriteAccess(apiKeyId: string, writeAccess: boolean): Promise<void> {
    const credential = await this.require(apiKeyId);
    credential.setWriteAccess(writeAccess);
    await this.apiKeys.save(credential, ''); // hash already persisted; field update only
    await this.events.publish({ type: 'ApiKeyUpdated', payload: { apiKeyId } });
  }

  async revoke(apiKeyId: string): Promise<void> {
    const credential = await this.require(apiKeyId);
    credential.revoke();
    await this.apiKeys.save(credential, ''); // hash already persisted; status update only
    await this.events.publish({ type: 'ApiKeyRevoked', payload: { apiKeyId } });
  }

  private async require(apiKeyId: string): Promise<ApiClientCredential> {
    const list = await this.apiKeys.listByTenant();
    const credential = list.find((c) => c.id === apiKeyId);
    if (!credential) throw new Error('API key not found');
    return credential;
  }
}
