import { createLogger } from '@/lib/logger';
import { registerJobHandler } from './make-platform';
import { getAdsOAuthApp, canonicalAdsPlatform, type AdsAppPlatform } from '@/lib/config/ads-apps';
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
import { SyncAdInsightsService, type SyncableConnection } from '@/modules/acquisition-ads/application/sync-ad-insights.service';
import { AssignAdFunnelService } from '@/modules/acquisition-ads/application/assign-ad-funnel.service';
import { PrismaConnectionRepository } from '@/modules/acquisition-ads/infra/prisma/connection.repository';
import { PrismaPostbackRepository } from '@/modules/acquisition-ads/infra/prisma/postback.repository';
import { PrismaEventMappingRepository } from '@/modules/acquisition-ads/infra/prisma/mapping.repository';
import { PrismaAttributionStore } from '@/modules/acquisition-ads/infra/prisma/attribution.store';
import { PrismaFunnelBindingRepo } from '@/modules/acquisition-ads/infra/prisma/funnel-binding.repo';
import { PrismaAdCreativeRepository } from '@/modules/acquisition-ads/infra/prisma/creative.repository';
import { PrismaAdDailyMetricRepository } from '@/modules/acquisition-ads/infra/prisma/daily-metric.repository';
import { PrismaAdSyncRunRepository } from '@/modules/acquisition-ads/infra/prisma/sync-run.repository';
import { MetaOAuthAdapter } from '@/modules/acquisition-ads/infra/platforms/meta/oauth.adapter';
import { GoogleOAuthAdapter } from '@/modules/acquisition-ads/infra/platforms/google/oauth.adapter';
import { TikTokOAuthAdapter } from '@/modules/acquisition-ads/infra/platforms/tiktok/oauth.adapter';
import { MetaConversionApiAdapter } from '@/modules/acquisition-ads/infra/platforms/meta/conversion-api.adapter';
import { GoogleConversionApiAdapter } from '@/modules/acquisition-ads/infra/platforms/google/conversion-api.adapter';
import { TikTokConversionApiAdapter } from '@/modules/acquisition-ads/infra/platforms/tiktok/conversion-api.adapter';
import { MetaInsightsAdapter } from '@/modules/acquisition-ads/infra/platforms/meta/insights.adapter';
import { GoogleAdsInsightsAdapter } from '@/modules/acquisition-ads/infra/platforms/google/insights.adapter';
import { TikTokInsightsAdapter } from '@/modules/acquisition-ads/infra/platforms/tiktok/insights.adapter';
import { MetaAccountDiscoveryAdapter } from '@/modules/acquisition-ads/infra/platforms/meta/discovery.adapter';
import { GoogleAccountDiscoveryAdapter } from '@/modules/acquisition-ads/infra/platforms/google/discovery.adapter';
import { TikTokAccountDiscoveryAdapter } from '@/modules/acquisition-ads/infra/platforms/tiktok/discovery.adapter';
import type { AdInsightsPort, AdInsightsFetchInput, AdAccountDiscoveryPort } from '@/modules/acquisition-ads/application/ports/outbound';

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

// YYYY-MM-DD "today" in the given IANA zone. Only place in Node allowed to do timezone math:
// it computes a label ("the account's local today"), never an aggregation boundary.
function todayInZone(timezone: string | null): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export interface AdsDeps {
  prisma: {
    adAccountConnection: any;
    adConversionDestination: any;
    postback: any;
    eventMappingProfile: any;
    adAttributionTouch: any;
    funnelAdConnection: any;
    adCreative: any;
    adDailyMetric: any;
    adSyncRun: any;
    page: any;
    funnel: any;
  };
  config: { getConfig(key: string, envFallback?: string): Promise<string | undefined> };
  jobQueue: { enqueue(job: { kind: string; idempotencyKey: string; payload: unknown; coalesce?: boolean }): Promise<void> };
  events: { publish(e: { type: string; payload: unknown }): Promise<void> };
  newId: () => string;
  // Async because the state is HMAC-signed (Web Crypto) and its single-use nonce is stored in
  // and consumed from the cache.
  decodeState: (state: string) => Promise<{ platform: string; externalAccountId: string }>;
  encodeState: (input: { platform: string }) => Promise<string>;
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
  const creativeRepo = new PrismaAdCreativeRepository(deps.prisma.adCreative, deps.newId);
  const metricRepo = new PrismaAdDailyMetricRepository(deps.prisma.adDailyMetric, deps.newId);
  const syncRunRepo = new PrismaAdSyncRunRepository(deps.prisma.adSyncRun, deps.newId);

  // Prefetched once per composition: StartAdConnectionService/CompleteAdConnectionService/
  // RefreshConnectionTokensService all call oauthFor(platform) synchronously, so credentials
  // cannot be resolved lazily inside it.
  const apps = new Map<AdsAppPlatform, { clientId: string; clientSecret: string; developerToken?: string }>();
  for (const p of ['META', 'GOOGLE', 'TIKTOK', 'BING_ADS'] as const) {
    const app = await getAdsOAuthApp(p);
    if (app) apps.set(p, app);
  }

  const oauthFor = (platform: string) => {
    const creds = apps.get(canonicalAdsPlatform(platform)) ?? { clientId: '', clientSecret: '' };
    const p = canonicalPlatform(platform);
    if (p === 'META') return new MetaOAuthAdapter(creds);
    if (p === 'GOOGLE') return new GoogleOAuthAdapter(creds);
    return new TikTokOAuthAdapter(creds);
  };

  // SyncDeps.insightsFor(platform) is a synchronous, platform-only contract (Task 7, unchanged
  // here), so it cannot receive a specific connection's reportingCurrency directly. This map is
  // primed by listConnections() below (which already reads every AdAccountConnection row) and
  // read here by externalAccountId; TikTok's adapter is the only one that needs it.
  const tiktokCurrencyByAccount = new Map<string, string | null>();

  function makeTikTokInsightsPort(): AdInsightsPort {
    const resolve = (accountId: string) => new TikTokInsightsAdapter(undefined, tiktokCurrencyByAccount.get(accountId) ?? null);
    return {
      platform: 'TIKTOK',
      fetchAccountTimezone: (input) => resolve(input.externalAccountId).fetchAccountTimezone(input),
      fetchAdInsights: async (input: AdInsightsFetchInput) => {
        const hadCachedCurrency = (tiktokCurrencyByAccount.get(input.externalAccountId) ?? null) !== null;
        const adapter = resolve(input.externalAccountId);
        const result = await adapter.fetchAdInsights(input);
        // Persist once, exactly like reportingTimezone: the next sync then never has to pay for
        // the extra fetchAdvertiserInfo request TikTokInsightsAdapter makes when currency is null.
        if (!hadCachedCurrency && adapter.resolvedCurrency) {
          tiktokCurrencyByAccount.set(input.externalAccountId, adapter.resolvedCurrency);
          await deps.prisma.adAccountConnection.updateMany({
            where: { platform: 'TIKTOK', externalAccountId: input.externalAccountId },
            data: { reportingCurrency: adapter.resolvedCurrency },
          });
        }
        return result;
      },
    };
  }

  const insightsFor = (platform: string): AdInsightsPort | null => {
    const p = canonicalAdsPlatform(platform);
    if (p === 'META') return new MetaInsightsAdapter();
    if (p === 'GOOGLE') return new GoogleAdsInsightsAdapter();
    if (p === 'TIKTOK') return makeTikTokInsightsPort();
    // Bing has OAuth and conversions but no insights adapter.
    return null;
  };

  const listConnections = async (): Promise<SyncableConnection[]> => {
    const rows = await deps.prisma.adAccountConnection.findMany();
    for (const r of rows) {
      if (r.platform === 'TIKTOK') tiktokCurrencyByAccount.set(r.externalAccountId, r.reportingCurrency ?? null);
    }
    return rows.map((r: any) => ({
      id: r.id,
      platform: r.platform,
      externalAccountId: r.externalAccountId,
      reportingTimezone: r.reportingTimezone ?? null,
    }));
  };

  const accessTokenFor = async (connectionId: string) => {
    const connection = await connectionRepo.findById(connectionId);
    if (!connection) throw new Error(`Ad connection ${connectionId} not found`);
    const accessToken = await tokenCipher.open(connection.accessToken);
    if (connection.platform === 'GOOGLE') {
      return { accessToken, developerToken: apps.get('GOOGLE')?.developerToken };
    }
    return { accessToken };
  };

  const loadPages = async (): Promise<Array<{ id: string; slug: string }>> =>
    deps.prisma.page.findMany({ select: { id: true, slug: true } });

  const loadFunnels = async (): Promise<Array<{ id: string; steps: unknown }>> =>
    deps.prisma.funnel.findMany({ select: { id: true, steps: true } });

  const saveAccountTimezone = async (connectionId: string, timezone: string): Promise<void> => {
    await deps.prisma.adAccountConnection.update({ where: { id: connectionId }, data: { reportingTimezone: timezone } });
  };

  const markSynced = async (connectionId: string, at: Date): Promise<void> => {
    await deps.prisma.adAccountConnection.update({ where: { id: connectionId }, data: { lastInsightsSyncAt: at } });
  };

  const syncInsights = new SyncAdInsightsService({
    creativeRepo,
    metricRepo,
    syncRunRepo,
    insightsFor,
    listConnections,
    accessTokenFor,
    loadPages,
    loadFunnels,
    saveAccountTimezone,
    markSynced,
    today: todayInZone,
    logger: logger.child('insights'),
  });

  const assignAdFunnel = new AssignAdFunnelService({
    creativeRepo,
    funnelExists: async (funnelId: string) => (await deps.prisma.funnel.findFirst({ where: { id: funnelId } })) != null,
  });

  const discoveryFor = (_platform: string) => ({
    discover: async () => [] as { id: string; kind: 'PIXEL' | 'CUSTOMER_LIST' | 'EVENT_SET'; externalId: string; isDefault: boolean }[],
  });

  // Queried once at authorization time, unlike insightsFor's per-sync credentials threading, so
  // platform credentials (Google's developer token, TikTok's app id/secret) are bound here from
  // the same `apps` map oauthFor already closes over, rather than passed through on every call.
  const accountDiscoveryFor = (platform: string): AdAccountDiscoveryPort => {
    const p = canonicalPlatform(platform);
    if (p === 'META') return new MetaAccountDiscoveryAdapter();
    if (p === 'GOOGLE') return new GoogleAccountDiscoveryAdapter(apps.get('GOOGLE')?.developerToken);
    return new TikTokAccountDiscoveryAdapter(apps.get('TIKTOK'));
  };

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
    accountDiscoveryFor,
    tokenCipher,
    connectionRepo,
    events: deps.events,
    decodeState: deps.decodeState,
    newId: deps.newId,
    logger: logger.child('connect'),
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
    syncInsights, assignAdFunnel, creativeRepo,
    // Exposed alongside oauthFor (already public for the same reason): SyncAdInsightsService
    // holds these privately, but composition-root tests need to exercise the routing/decryption
    // logic directly rather than only through a full sync run.
    insightsFor, accessTokenFor, listConnections, accountDiscoveryFor,
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
