import type { APIContext } from 'astro';
import { getTenantPrisma } from '../modules/platform/infra/prisma-tenant-extension';
import { getBasePrisma } from '../lib/db';
import { OutboxEventPublisher } from '../modules/platform/infra/outbox-event-publisher';
import { makePlatform } from './make-platform';
import { getConfig } from '../lib/config/get-config';
import { getCurrentTenantId } from '../lib/tenant/context';
import { issueOAuthState, consumeOAuthState } from '../lib/auth/oauth-state';
import { getPrincipal } from '../modules/identity/application/principal-resolution';
import { getAdsOAuthApp } from '../lib/config/ads-apps';
import type { AdsDeps } from './make-acquisition-ads';

type Locals = APIContext['locals'];

export type { AdsDeps } from './make-acquisition-ads';

// OAuth state is bound to the principal that STARTED the flow, so both ends need an interactive
// user. Without this binding a victim's browser could complete an attacker-initiated callback.
function requireOwner(): { tenantId: string; userId: string } {
  const principal = getPrincipal();
  if (!principal || principal.kind !== 'user') {
    throw new Error('OAuth connection flows require an interactive user principal');
  }
  return { tenantId: getCurrentTenantId(), userId: principal.userId };
}

// Named export (rather than inlined into createAdsDepsForRequest's returned object) so tests can
// call it directly against make-acquisition-ads.ts's oauthFor and assert both resolve the same KV
// key for a given platform alias -- the exact regression this shared canonicalAdsPlatform mapping
// exists to prevent.
export const clientIdFor = async (platform: string): Promise<string> =>
  (await getAdsOAuthApp(platform))?.clientId ?? '';

export async function createAdsDepsForRequest(locals?: Locals): Promise<AdsDeps> {
  const db = getTenantPrisma();
  const base = getBasePrisma();
  const platform = makePlatform();

  return {
    prisma: {
      adAccountConnection: db.adAccountConnection,
      adConversionDestination: db.adConversionDestination,
      postback: db.postback,
      eventMappingProfile: db.eventMappingProfile,
      adAttributionTouch: db.adAttributionTouch,
      funnelAdConnection: db.funnelAdConnection,
      adCreative: db.adCreative,
      adDailyMetric: db.adDailyMetric,
      adSyncRun: db.adSyncRun,
      page: db.page,
      funnel: db.funnel,
    },
    config: { getConfig: (key, envFallback) => getConfig(key, envFallback) as Promise<string | undefined> },
    jobQueue: {
      enqueue: async (job) => {
        await platform.enqueueJob.enqueue({
          kind: job.kind,
          idempotencyKey: job.idempotencyKey,
          payload: job.payload,
          coalesce: job.coalesce,
        });
      },
    },
    events: {
      publish: async (e) => {
        await platform.eventPublisher.publish({
          eventId: crypto.randomUUID(),
          type: e.type,
          tenantId: getCurrentTenantId(),
          occurredAt: new Date(),
          payload: e.payload as Record<string, unknown>,
          correlation: {},
        });
      },
    },
    newId: () => crypto.randomUUID(),
    decodeState: (state: string) => consumeOAuthState(state, requireOwner()),
    encodeState: (input: { platform: string }) =>
      issueOAuthState({ platform: input.platform, ...requireOwner() }),
    // Shares canonicalAdsPlatform/ADS_APP_KEYS with oauthFor's credential lookup, so a 'FACEBOOK'
    // connection and a 'META' adapter cannot read different KV keys.
    clientIdFor,
  };
}
