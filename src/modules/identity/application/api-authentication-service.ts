import type { ApiClientPrincipal } from '../../shared-kernel/principal';
import type { ApiKeyRepositoryPort, SecretGeneratorPort, ClockPort } from './ports/outbound';

export class ApiAuthenticationService {
  constructor(
    private readonly apiKeys: ApiKeyRepositoryPort,
    private readonly secrets: SecretGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async authenticate(authorizationHeader: string | null): Promise<ApiClientPrincipal | null> {
    const raw = this.extractBearer(authorizationHeader);
    if (!raw) return null;
    const keyHash = await this.secrets.hashSecret(raw);
    const found = await this.apiKeys.findByHashGlobal(keyHash);
    if (!found) return null;
    return {
      kind: 'apiClient',
      apiKeyId: found.credential.id,
      tenantId: found.tenantId,
      permissions: found.credential.effectivePermissions(this.clock.now()),
      writeAccess: found.credential.writeAccess,
    };
  }

  private extractBearer(header: string | null): string | null {
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return null;
    return token;
  }
}
