import { createLogger } from '@/lib/logger';
import { registerJobHandler } from './make-platform';
import { WorkersTokenCipher } from '@/modules/acquisition-ads/infra/crypto/workers-token-cipher';
import { RecordConversionService } from '@/modules/acquisition-ads/application/record-conversion.service';
import { DispatchPostbackService } from '@/modules/acquisition-ads/application/dispatch-postback.service';
import { CaptureAttributionService } from '@/modules/acquisition-ads/application/capture-attribution.service';
import { StartAdConnectionService } from '@/modules/acquisition-ads/application/start-ad-connection.service';
import { CompleteAdConnectionService } from '@/modules/acquisition-ads/application/complete-ad-connection.service';
import { CreateTokenConnectionService } from '@/modules/acquisition-ads/application/create-token-connection.service';
import { UpdateTokenConnectionService } from '@/modules/acquisition-ads/application/update-token-connection.service';
import { RetrySweepService } from '@/modules/acquisition-ads/application/retry-sweep.service';
import { ConfigureEventMappingService } from '@/modules/acquisition-ads/application/configure-event-mapping.service';
import { RefreshConnectionTokensService } from '@/modules/acquisition-ads/application/refresh-connection-tokens.service';
import { PrismaConnectionRepository } from '@/modules/acquisition-ads/infra/prisma/connection.repository';
import { PrismaPostbackRepository } from '@/modules/acquisition-ads/infra/prisma/postback.repository';
import { PrismaEventMappingRepository } from '@/modules/acquisition-ads/infra/prisma/mapping.repository';
import { PrismaAttributionStore } from '@/modules/acquisition-ads/infra/prisma/attribution.store';
import { PrismaFunnelBindingRepo } from '@/modules/acquisition-ads/infra/prisma/funnel-binding.repo';
import { MetaOAuthAdapter } from '@/modules/acquisition-ads/infra/platforms/meta/oauth.adapter';
import { GoogleOAuthAdapter } from '@/modules/acquisition-ads/infra/platforms/google/oauth.adapter';
import { TikTokOAuthAdapter } from '@/modules/acquisition-ads/infra/platforms/tiktok/oauth.adapter';
import { MetaConversionApiAdapter } from '@/modules/acquisition-ads/infra/platforms/meta/conversion-api.adapter';
import { GoogleConversionApiAdapter } from '@/modules/acquisition-ads/infra/platforms/google/conversion-api.adapter';
import { TikTokConversionApiAdapter } from '@/modules/acquisition-ads/infra/platforms/tiktok/conversion-api.adapter';

const logger = createLogger('AcquisitionAds');

// Connections/UI store provider aliases ('FACEBOOK', 'GOOGLE_ADS') while the platform adapters key
// on 'META'/'GOOGLE'/'TIKTOK'; normalize so a Facebook/Google connection reaches the right adapter
// instead of silently falling through to TikTok.
function canonicalPlatform(platform: string): 'META' | 'GOOGLE' | 'TIKTOK' {
  const p = platform.toUpperCase();
  if (p === 'META' || p === 'FACEBOOK') return 'META';
  if (p === 'GOOGLE' || p === 'GOOGLE_ADS') return 'GOOGLE';
  return 'TIKTOK';
}

export interface AdsDeps {
  prisma: {
    adAccountConnection: any;
    adConversionDestination: any;
    postback: any;
    eventMappingProfile: any;
    adAttributionTouch: any;
    funnelAdConnection: any;
  };
  config: { getConfig(key: string, envFallback?: string): Promise<string | undefined> };
  jobQueue: { enqueue(job: { kind: string; idempotencyKey: string; payload: unknown; coalesce?: boolean }): Promise<void> };
  events: { publish(e: { type: string; payload: unknown }): Promise<void> };
  newId: () => string;
  decodeState: (state: string) => { platform: string; externalAccountId: string };
  encodeState: (input: { platform: string }) => string;
  clientIdFor: (platform: string) => Promise<string>;
}

export async function makeAcquisitionAds(deps: AdsDeps) {
  const rawKeyHex = (await deps.config.getConfig('ads.token_cipher.key', process.env.ADS_TOKEN_CIPHER_KEY)) ?? '';
  const rawKeyHexStripped = rawKeyHex.replace(/\s/g, '');
  const bytes = rawKeyHexStripped.length >= 64
    ? Uint8Array.from(rawKeyHexStripped.match(/.{1,2}/g)?.map((h) => parseInt(h, 16)) ?? new Array(32).fill(0))
    : new Uint8Array(32);
  const tokenCipher = await WorkersTokenCipher.fromRawKey(bytes);

  const connectionRepo = new PrismaConnectionRepository(
    deps.prisma.adAccountConnection,
    deps.prisma.adConversionDestination,
  );
  const postbackRepo = new PrismaPostbackRepository(deps.prisma.postback);
  const mappingRepo = new PrismaEventMappingRepository(deps.prisma.eventMappingProfile);
  const attributionStore = new PrismaAttributionStore(deps.prisma.adAttributionTouch);
  const funnelBindingRepo = new PrismaFunnelBindingRepo(deps.prisma.funnelAdConnection);

  const oauthFor = (platform: string) => {
    const creds = { clientId: '', clientSecret: '' };
    const p = canonicalPlatform(platform);
    if (p === 'META') return new MetaOAuthAdapter(creds);
    if (p === 'GOOGLE') return new GoogleOAuthAdapter(creds);
    return new TikTokOAuthAdapter(creds);
  };

  const discoveryFor = (_platform: string) => ({
    discover: async () => [] as { id: string; kind: 'PIXEL' | 'CUSTOMER_LIST' | 'EVENT_SET'; externalId: string; isDefault: boolean }[],
  });

  const conversionApiFor = (platform: string) => {
    const p = canonicalPlatform(platform);
    return p === 'META' ? new MetaConversionApiAdapter()
      : p === 'GOOGLE' ? new GoogleConversionApiAdapter()
      : new TikTokConversionApiAdapter();
  };

  const recordConversion = new RecordConversionService({
    mappingRepo, attributionStore, postbackRepo,
    jobQueue: deps.jobQueue, events: deps.events, newId: deps.newId,
  });

  const captureAttribution = new CaptureAttributionService({ attributionStore });

  const retrySweep = new RetrySweepService({
    postbackRepo, jobQueue: deps.jobQueue, now: Date.now,
  });

  const dispatchPostback = new DispatchPostbackService({
    postbackRepo, connectionRepo,
    destinationToConnection: async (destId) => {
      const row = await deps.prisma.adConversionDestination.findFirst({ where: { id: destId } });
      return row?.connectionId ?? null;
    },
    tokenCipher,
    conversionApiFor,
    events: deps.events,
  });

  const startConnection = new StartAdConnectionService({
    oauthFor,
    encodeState: deps.encodeState,
    clientIdFor: deps.clientIdFor,
  });

  const completeConnection = new CompleteAdConnectionService({
    oauthFor,
    discoveryFor,
    tokenCipher,
    connectionRepo,
    events: deps.events,
    decodeState: deps.decodeState,
    newId: deps.newId,
  });

  const createTokenConnection = new CreateTokenConnectionService({
    tokenCipher,
    connectionRepo,
    events: deps.events,
    newId: deps.newId,
  });

  const updateTokenConnection = new UpdateTokenConnectionService({
    tokenCipher,
    connectionRepo,
  });

  const configureMapping = new ConfigureEventMappingService({
    mappingRepo,
    newId: deps.newId,
  });

  const refreshTokens = new RefreshConnectionTokensService({
    oauthFor,
    tokenCipher,
    connectionRepo,
  });

  logger.debug('acquisition-ads composition root constructed');
  return {
    recordConversion, captureAttribution, retrySweep, dispatchPostback,
    startConnection, completeConnection, createTokenConnection, updateTokenConnection, configureMapping, refreshTokens,
    connectionRepo, postbackRepo, mappingRepo, attributionStore, oauthFor, funnelBindingRepo,
  };
}

export async function handleAdsPostbackDispatch(payload: { postbackId: string }): Promise<{ status: string }> {
  const { createAdsDepsForRequest } = await import('./make-ads-deps');
  const ads = await makeAcquisitionAds(await createAdsDepsForRequest());
  return ads.dispatchPostback.dispatch({ postbackId: payload.postbackId });
}

registerJobHandler('ads.postback.dispatch', (payload) =>
  handleAdsPostbackDispatch(payload as { postbackId: string }),
);
