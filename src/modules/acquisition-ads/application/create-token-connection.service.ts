import { AdAccountConnection } from '../domain/connection/ad-account-connection';
import type { PlatformRef } from '../domain/value-objects/platform-ref';
import type { DestinationKind } from '../domain/connection/ad-account-connection';
import { metaCapability } from '../infra/platforms/meta/capability';
import { tiktokCapability } from '../infra/platforms/tiktok/capability';
import type { ConnectionRepositoryPort, TokenCipherPort } from './ports/outbound';

export const FAR_FUTURE_MS = 100 * 365 * 24 * 60 * 60 * 1000;

export interface TokenPlatformSpec {
  scopes: string[];
  accountIdKey: string;
  tokenKey: string;
  destinationKind: DestinationKind;
}

export const TOKEN_PLATFORMS: Record<string, TokenPlatformSpec> = {
  FACEBOOK: {
    scopes: metaCapability.requiredConversionScopes,
    accountIdKey: 'pixelId',
    tokenKey: 'accessToken',
    destinationKind: 'PIXEL',
  },
  TIKTOK: {
    scopes: tiktokCapability.requiredConversionScopes,
    accountIdKey: 'pixelCode',
    tokenKey: 'accessToken',
    destinationKind: 'EVENT_SET',
  },
  BING_ADS: {
    scopes: ['conversions.manage'],
    accountIdKey: 'uetTagId',
    tokenKey: 'capiToken',
    destinationKind: 'PIXEL',
  },
};

interface Deps {
  tokenCipher: TokenCipherPort;
  connectionRepo: ConnectionRepositoryPort;
  events: { publish(event: { type: string; payload: unknown }): Promise<void> };
  newId: () => string;
}

export class CreateTokenConnectionService {
  constructor(private readonly deps: Deps) {}

  async create(input: {
    platform: string;
    name: string;
    credentials: Record<string, string>;
  }): Promise<{ id: string }> {
    const spec = TOKEN_PLATFORMS[input.platform];
    if (!spec) throw new Error(`unsupported token ad platform: ${input.platform}`);

    const accessToken = input.credentials[spec.tokenKey];
    if (!accessToken) throw new Error(`missing ${spec.tokenKey} for ${input.platform}`);

    const externalAccountId = input.credentials[spec.accountIdKey]?.trim() || input.name.trim();
    if (!externalAccountId) throw new Error('externalAccountId is required');

    const sealedAccess = await this.deps.tokenCipher.seal(accessToken, 1);
    const sealedRefresh = await this.deps.tokenCipher.seal('', 1);

    const connection = AdAccountConnection.connect({
      id: this.deps.newId(),
      platform: input.platform as PlatformRef,
      externalAccountId,
      accessToken: sealedAccess,
      refreshToken: sealedRefresh,
      accessTokenExpiresAt: new Date(Date.now() + FAR_FUTURE_MS),
      grantedScopes: spec.scopes,
      requiredConversionScopes: spec.scopes,
    });

    connection.addDestination({
      id: this.deps.newId(),
      kind: spec.destinationKind,
      externalId: externalAccountId,
      isDefault: true,
    });

    await this.deps.connectionRepo.save(connection);
    await this.deps.events.publish({ type: 'AdAccountConnected', payload: { connectionId: connection.id } });
    return { id: connection.id };
  }
}
