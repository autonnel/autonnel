import type { AdAccountConnection, ConversionDestination } from '../../domain/connection/ad-account-connection';
import type { Postback } from '../../domain/postback/postback';
import type { EventMappingProfile } from '../../domain/mapping/event-mapping-profile';
import type { AttributionTouch } from '../../domain/value-objects/attribution-touch';
import type { SealedToken } from '../../domain/value-objects/sealed-token';
import type { PlatformRef, PlatformCapability } from '../../domain/value-objects/platform-ref';
import type { NeutralPayload } from '../../domain/services/payload-assembler';
import type { ConversionEvent } from '../../domain/value-objects/conversion-event';

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

export interface ConnectionRepositoryPort {
  findById(id: string): Promise<AdAccountConnection | null>;
  findByPlatformAccount(platform: PlatformRef, externalAccountId: string): Promise<AdAccountConnection | null>;
  list(): Promise<AdAccountConnection[]>;
  save(connection: AdAccountConnection): Promise<void>;
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
