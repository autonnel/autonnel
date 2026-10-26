import type { AdAccountConnection, ConversionDestination } from '../../domain/connection/ad-account-connection';
import type { Postback } from '../../domain/postback/postback';
import type { EventMappingProfile } from '../../domain/mapping/event-mapping-profile';
import type { AttributionTouch } from '../../domain/value-objects/attribution-touch';
import type { SealedToken } from '../../domain/value-objects/sealed-token';
import type { PlatformRef, PlatformCapability } from '../../domain/value-objects/platform-ref';
import type { NeutralPayload } from '../../domain/services/payload-assembler';
import type { ConversionEvent } from '../../domain/value-objects/conversion-event';
import type { MatchState } from '../../domain/services/url-attribution';

export interface OAuthTokenGrant {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
  grantedScopes: string[];
}

export interface PlatformOAuthPort {
  capability(): PlatformCapability;
  buildAuthorizeUrl(input: { state: string; redirectUri: string; clientId: string }): string;
  exchangeCode(input: { code: string; redirectUri: string }): Promise<OAuthTokenGrant>;
  refresh(input: { refreshToken: string }): Promise<OAuthTokenGrant>;
}

export interface PlatformConversionApiPort {
  platform: PlatformRef;
  sendConversion(input: {
    accessToken: string;
    destination: ConversionDestination;
    event: ConversionEvent;
    payload: NeutralPayload;
    testEventCode?: string;
  }): Promise<{ acknowledged: boolean; providerRef?: string; error?: string; retryable?: boolean }>;
}

export interface DestinationDiscoveryPort {
  discover(input: { accessToken: string; externalAccountId: string }): Promise<ConversionDestination[]>;
}

export interface DiscoveredAdAccount {
  externalAccountId: string;
  name: string | null;
  currency: string | null;
  timezone: string | null;
}

// Queried once at authorization time (see CompleteAdConnectionService), not per sync like
// AdInsightsPort, so implementations bind platform credentials (developer token, app id/secret)
// via their constructor rather than through this method's input.
export interface AdAccountDiscoveryPort {
  platform: string;
  listAccounts(input: {
    accessToken: string;
    developerToken?: string;
    loginCustomerId?: string;
  }): Promise<DiscoveredAdAccount[]>;
}

export interface ConnectionRepositoryPort {
  findById(id: string): Promise<AdAccountConnection | null>;
  findByPlatformAccount(platform: PlatformRef, externalAccountId: string): Promise<AdAccountConnection | null>;
  list(): Promise<AdAccountConnection[]>;
  save(connection: AdAccountConnection): Promise<void>;
  // Reporting metadata (currency/timezone) lives only on the row, not the domain entity, and a
  // missing value here must leave the existing column untouched rather than clobber it with null
  // -- not every platform's account list returns it, and a later sync fills it in lazily.
  saveDiscoveredMeta(input: {
    platform: PlatformRef;
    externalAccountId: string;
    currency: string | null;
    timezone: string | null;
  }): Promise<void>;
}

export interface PostbackRepositoryPort {
  findByDedup(destinationId: string, eventId: string): Promise<Postback | null>;
  findById(id: string): Promise<Postback | null>;
  claimDuePending(limit: number, nowMs: number): Promise<Postback[]>;
  save(postback: Postback): Promise<void>;
}

export interface EventMappingRepositoryPort {
  findActive(): Promise<EventMappingProfile | null>;
  save(profile: EventMappingProfile): Promise<void>;
}

export interface AttributionStorePort {
  put(input: { key: string; touch: AttributionTouch; ttlSec: number }): Promise<void>;
  get(key: string): Promise<AttributionTouch | null>;
}

export interface TokenCipherPort {
  seal(plaintext: string, tokenVersion: number): Promise<SealedToken>;
  open(token: SealedToken): Promise<string>;
}

// Re-exported platform ports (do not redefine; import the real types in composition).
export type { JobEnqueuePort } from '../../../shared-kernel/event-envelope';
export type { DomainEventPublisherPort } from '../../../shared-kernel/event-envelope';

export interface TenantConfigPort {
  get(key: string, envFallback?: string): Promise<string | null>;
}

export interface CreativeUpsert {
  externalAdId: string;
  name: string;
  status: string;
  campaignExternalId: string | null;
  campaignName: string | null;
  adsetExternalId: string | null;
  adsetName: string | null;
  destinationUrl: string | null;
  normalizedPath: string | null;
  autoFunnelId: string | null;
  matchState: MatchState;
  lastSeenAt: Date;
}

export interface CreativeRow extends CreativeUpsert {
  id: string;
  connectionId: string;
  platform: string;
  manualFunnelId: string | null;
}

export interface AdCreativeRepositoryPort {
  // Returns externalAdId -> creative id so the caller can write metrics in the same pass.
  upsertMany(connectionId: string, platform: string, rows: CreativeUpsert[]): Promise<Map<string, string>>;
  listByConnection(connectionId: string): Promise<CreativeRow[]>;
  findById(creativeId: string): Promise<CreativeRow | null>;
  setManualFunnel(creativeId: string, funnelId: string | null): Promise<void>;
}

export interface DailyMetricUpsert {
  creativeId: string;
  date: string; // YYYY-MM-DD in the ad account timezone
  currency: string;
  spendMinor: number;
  impressions: number;
  clicks: number;
  linkClicks: number | null;
  conversions: number;
  // Null when the platform reports no checkout-start metric at all.
  initiateCheckout: number | null;
  conversionValueMinor: number | null;
}

export interface AdDailyMetricRepositoryPort {
  upsertMany(rows: DailyMetricUpsert[]): Promise<number>;
}

export interface AdSyncRunRepositoryPort {
  start(input: { connectionId: string; windowStart: string; windowEnd: string }): Promise<string>;
  finish(input: {
    runId: string;
    status: 'OK' | 'FAILED';
    adsFetched: number;
    daysUpserted: number;
    truncated: boolean;
    error?: string;
  }): Promise<void>;
}

export interface AdInsightRow {
  externalAdId: string;
  name: string;
  status: string;
  campaignExternalId: string | null;
  campaignName: string | null;
  adsetExternalId: string | null;
  adsetName: string | null;
  destinationUrl: string | null;
  // YYYY-MM-DD in the ad account's own reporting timezone. Never converted.
  date: string;
  currency: string;
  spendMinor: number;
  impressions: number;
  clicks: number;
  linkClicks: number | null;
  conversions: number;
  initiateCheckout: number | null;
  conversionValueMinor: number | null;
}

export interface AdInsightsFetchInput {
  accessToken: string;
  externalAccountId: string;
  start: string; // YYYY-MM-DD, account timezone
  end: string; // YYYY-MM-DD, account timezone, inclusive
  developerToken?: string;
  loginCustomerId?: string;
}

export interface AdInsightsPort {
  platform: string;
  fetchAdInsights(input: AdInsightsFetchInput): Promise<{ rows: AdInsightRow[]; truncated: boolean }>;
  fetchAccountTimezone(input: { accessToken: string; externalAccountId: string; developerToken?: string }): Promise<string | null>;
}
