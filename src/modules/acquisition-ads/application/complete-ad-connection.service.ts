import { AdAccountConnection } from '../domain/connection/ad-account-connection';
import type {
  PlatformOAuthPort, DestinationDiscoveryPort, ConnectionRepositoryPort, TokenCipherPort,
} from './ports/outbound';

interface Deps {
  oauthFor(platform: string): PlatformOAuthPort;
  discoveryFor(platform: string): DestinationDiscoveryPort;
  tokenCipher: TokenCipherPort;
  connectionRepo: ConnectionRepositoryPort;
  events: { publish(event: { type: string; payload: unknown }): Promise<void> };
  decodeState(state: string): { platform: string; externalAccountId: string };
  newId: () => string;
}

export class CompleteAdConnectionService {
  constructor(private readonly deps: Deps) {}

  async complete(input: { state: string; code: string; redirectUri: string }): Promise<{ connectionId: string }> {
    const { platform, externalAccountId } = this.deps.decodeState(input.state);
    const oauth = this.deps.oauthFor(platform);
    const cap = oauth.capability();
    const grant = await oauth.exchangeCode({ code: input.code, redirectUri: input.redirectUri });
    const accessToken = await this.deps.tokenCipher.seal(grant.accessToken, 1);
    const refreshToken = await this.deps.tokenCipher.seal(grant.refreshToken, 1);

    const connection = AdAccountConnection.connect({
      id: this.deps.newId(),
      platform: cap.platform,
      externalAccountId,
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(Date.now() + grant.expiresInSec * 1000),
      grantedScopes: grant.grantedScopes,
      requiredConversionScopes: cap.requiredConversionScopes,
    });

    for (const d of await this.deps.discoveryFor(platform).discover({ accessToken: grant.accessToken, externalAccountId })) {
      connection.addDestination(d);
    }
    await this.deps.connectionRepo.save(connection);
    await this.deps.events.publish({ type: 'AdAccountConnected', payload: { connectionId: connection.id } });
    return { connectionId: connection.id };
  }
}
