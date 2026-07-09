import type { Money } from '../../../shared-kernel/money';
import type { ConsentLevel } from '../../domain/value-objects/consent-state';
import type { InternalTrigger, MappingRule } from '../../domain/mapping/event-mapping-profile';

export interface AttributionIngestPort {
  capture(input: {
    sessionId: string;
    visitorId?: string;
    query: Record<string, string | undefined>;
    fbp?: string;
    ga?: string;
    landingUrl: string;
    landingTimestampMs: number;
    transientIp?: string;
    transientUserAgent?: string;
  }): Promise<{ stored: boolean }>;
}

export interface ConversionTriggerPort {
  recordConversion(input: {
    trigger: InternalTrigger;
    sessionId: string;
    saleId?: string;
    funnelId: string;
    eventTimeMs: number;
    value?: Money;
    consentLevel: ConsentLevel;
    contactHandle?: { emailSha256?: string; phoneSha256?: string };
  }): Promise<{ enqueuedPostbacks: number }>;
}

export interface AdConnectionCommandPort {
  start(input: { platform: string; redirectUri: string }): Promise<{ authorizeUrl: string; state: string }>;
  complete(input: { state: string; code: string; redirectUri: string }): Promise<{ connectionId: string }>;
  configureMapping(input: { rules: MappingRule[] }): Promise<{ version: number }>;
  list(): Promise<unknown[]>;
}

export interface PostbackWorkerPort {
  dispatch(input: { postbackId: string }): Promise<{ status: string }>;
  retrySweep(input: { limit: number }): Promise<{ processed: number }>;
}
