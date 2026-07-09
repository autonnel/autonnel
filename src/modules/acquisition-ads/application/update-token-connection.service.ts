import { FAR_FUTURE_MS, TOKEN_PLATFORMS } from './create-token-connection.service';
import type { ConnectionRepositoryPort, TokenCipherPort } from './ports/outbound';

interface Deps {
  tokenCipher: TokenCipherPort;
  connectionRepo: ConnectionRepositoryPort;
}

export class UpdateTokenConnectionService {
  constructor(private readonly deps: Deps) {}

  // `name` is cosmetic/derived from externalAccountId and is not persisted; only
  // credential rotation mutates the connection.
  async update(input: {
    connectionId: string;
    name?: string;
    credentials?: Record<string, string>;
  }): Promise<{ updated: boolean }> {
    const connection = await this.deps.connectionRepo.findById(input.connectionId);
    if (!connection) throw new Error('connection not found');

    const credentials = input.credentials;
    if (!credentials || Object.keys(credentials).length === 0) {
      return { updated: false };
    }

    const spec = TOKEN_PLATFORMS[connection.platform];
    if (!spec) throw new Error(`unsupported token ad platform: ${connection.platform}`);

    const newToken = credentials[spec.tokenKey]?.trim();
    if (newToken) {
      const sealed = await this.deps.tokenCipher.seal(newToken, connection.tokenVersion + 1);
      connection.rotateAccessToken(sealed, new Date(Date.now() + FAR_FUTURE_MS));
    }

    const newAccountId = credentials[spec.accountIdKey]?.trim();
    if (newAccountId && newAccountId !== connection.externalAccountId) {
      connection.setDefaultDestinationExternalId(newAccountId);
    }

    await this.deps.connectionRepo.save(connection);
    return { updated: true };
  }
}
