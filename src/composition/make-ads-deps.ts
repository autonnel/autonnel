import type { APIContext } from 'astro';
import { getTenantPrisma } from '../modules/platform/infra/prisma-tenant-extension';
import { getBasePrisma } from '../lib/db';
import { OutboxEventPublisher } from '../modules/platform/infra/outbox-event-publisher';
import { makePlatform } from './make-platform';
import { getConfig } from '../lib/config/get-config';
import { getCurrentTenantId } from '../lib/tenant/context';
import type { AdsDeps } from './make-acquisition-ads';

type Locals = APIContext['locals'];

export type { AdsDeps } from './make-acquisition-ads';

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
    decodeState: (state: string) => {
      const parsed = JSON.parse(Buffer.from(state, 'base64').toString());
      return { platform: parsed.platform, externalAccountId: parsed.adPlatformId ?? '' };
    },
    encodeState: (input: { platform: string }) => {
      return Buffer.from(JSON.stringify({ platform: input.platform, csrf: crypto.randomUUID(), timestamp: Date.now() })).toString('base64');
    },
    clientIdFor: async (platform: string) => {
      const key = `ads.${platform.toLowerCase()}.client_id`;
      return (await getConfig(key)) ?? '';
    },
  };
}
