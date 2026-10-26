import { AdAccountConnection } from '../domain/connection/ad-account-connection';
import { NoAdAccountsDiscoveredError } from '../domain/errors';
import type {
  PlatformOAuthPort, DestinationDiscoveryPort, AdAccountDiscoveryPort, ConnectionRepositoryPort, TokenCipherPort,
  OAuthTokenGrant,
} from './ports/outbound';

interface LoggerLike {
  warn(msg: string, meta?: Record<string, unknown>): void;
}

interface Deps {
  oauthFor(platform: string): PlatformOAuthPort;
  discoveryFor(platform: string): DestinationDiscoveryPort;
  accountDiscoveryFor(platform: string): AdAccountDiscoveryPort;
  tokenCipher: TokenCipherPort;
  connectionRepo: ConnectionRepositoryPort;
  events: { publish(event: { type: string; payload: unknown }): Promise<void> };
  decodeState(state: string): Promise<{ platform: string; externalAccountId: string }>;
  newId: () => string;
  logger: LoggerLike;
}

export class CompleteAdConnectionService {
  constructor(private readonly deps: Deps) {}

  async complete(input: { state: string; code: string; redirectUri: string }): Promise<{ connectionIds: string[] }> {
    // The account is never known at authorize time (see oauth-state.ts), so decodeState's
    // externalAccountId is always empty; discovery below is the only source of truth for it.
    const { platform } = await this.deps.decodeState(input.state);
    const grant = await this.deps.oauthFor(platform).exchangeCode({ code: input.code, redirectUri: input.redirectUri });
    return this.persist(platform, grant);
  }

  // Entry point for flows that already hold a token grant, e.g. the hosted OAuth relay: it never
  // calls exchangeCode itself, so this reuses the same discovery + persistence path instead of
  // duplicating it.
  async completeFromGrant(input: { platform: string; grant: OAuthTokenGrant }): Promise<{ connectionIds: string[] }> {
    return this.persist(input.platform, input.grant);
  }

  private async persist(platform: string, grant: OAuthTokenGrant): Promise<{ connectionIds: string[] }> {
    const cap = this.deps.oauthFor(platform).capability();
    const accounts = await this.deps.accountDiscoveryFor(platform).listAccounts({ accessToken: grant.accessToken });

    // Persisting a connection with an empty externalAccountId is worse than failing: it looks
    // connected, collides with the next real account on (tenantId, platform, externalAccountId),
    // and can never sync because every insights adapter keys off this field verbatim.
    if (accounts.length === 0) {
      throw new NoAdAccountsDiscoveredError(platform);
    }

    const accessToken = await this.deps.tokenCipher.seal(grant.accessToken, 1);
    const refreshToken = await this.deps.tokenCipher.seal(grant.refreshToken, 1);
    const connectionIds: string[] = [];

    // Each account is independent (its own row, its own retry-safe upsert), so one account's
    // failure must not take down accounts discovered alongside it -- especially since discovery
    // and persistence already happened for whichever ones came first in the list.
    for (const account of accounts) {
      try {
        // Re-authorizing an already-connected account (expired token, re-consent) must update
        // that row, not collide with its unique (tenantId, platform, externalAccountId) index:
        // reusing its id here makes the save() below an update instead of an insert.
        const existing = await this.deps.connectionRepo.findByPlatformAccount(cap.platform, account.externalAccountId);
        const connection = AdAccountConnection.connect({
          id: existing?.id ?? this.deps.newId(),
          platform: cap.platform,
          externalAccountId: account.externalAccountId,
          accessToken,
          refreshToken,
          accessTokenExpiresAt: new Date(Date.now() + grant.expiresInSec * 1000),
          grantedScopes: grant.grantedScopes,
          requiredConversionScopes: cap.requiredConversionScopes,
        });

        const destinations = await this.deps.discoveryFor(platform).discover({
          accessToken: grant.accessToken,
          externalAccountId: account.externalAccountId,
        });
        for (const d of destinations) connection.addDestination(d);

        await this.deps.connectionRepo.save(connection);
        if (account.currency || account.timezone) {
          await this.deps.connectionRepo.saveDiscoveredMeta({
            platform: cap.platform,
            externalAccountId: account.externalAccountId,
            currency: account.currency,
            timezone: account.timezone,
          });
        }
        connectionIds.push(connection.id);
      } catch (err) {
        this.deps.logger.warn('failed to persist one discovered ad account; continuing with the rest', {
          platform: cap.platform,
          externalAccountId: account.externalAccountId,
          error: err,
        });
      }
    }

    // Every discovered account failed to persist: functionally the same dead end as discovering
    // zero accounts (nothing syncable resulted from this authorization), so it gets the same
    // stable error code rather than a generic connection_failed.
    if (connectionIds.length === 0) {
      throw new NoAdAccountsDiscoveredError(platform);
    }

    await this.deps.events.publish({ type: 'AdAccountConnected', payload: { platform: cap.platform, connectionIds } });
    return { connectionIds };
  }
}
