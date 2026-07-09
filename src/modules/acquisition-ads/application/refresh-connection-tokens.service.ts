import type { PlatformOAuthPort, ConnectionRepositoryPort, TokenCipherPort } from './ports/outbound';

interface Deps {
  oauthFor(platform: string): PlatformOAuthPort;
  tokenCipher: TokenCipherPort;
  connectionRepo: ConnectionRepositoryPort;
}

export class RefreshConnectionTokensService {
  constructor(private readonly deps: Deps) {}

  async refresh(input: { connectionId: string }): Promise<{ tokenVersion: number }> {
    const connection = await this.deps.connectionRepo.findById(input.connectionId);
    if (!connection) throw new Error(`Connection ${input.connectionId} not found`);
    const oauth = this.deps.oauthFor(connection.platform);
    const currentRefresh = await this.deps.tokenCipher.open(connection.refreshToken);
    const grant = await oauth.refresh({ refreshToken: currentRefresh });
    const nextVersion = connection.tokenVersion + 1;
    connection.rotateTokens({
      expectedTokenVersion: connection.tokenVersion,
      accessToken: await this.deps.tokenCipher.seal(grant.accessToken, nextVersion),
      refreshToken: await this.deps.tokenCipher.seal(grant.refreshToken, nextVersion),
      accessTokenExpiresAt: new Date(Date.now() + grant.expiresInSec * 1000),
    });
    await this.deps.connectionRepo.save(connection);
    return { tokenVersion: connection.tokenVersion };
  }
}
