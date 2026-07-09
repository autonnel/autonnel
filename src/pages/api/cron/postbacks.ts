import type { APIRoute } from 'astro';
import { withCronAuth, jsonResponse } from '@/lib/api-helpers';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';
import { createLogger } from '@/lib/logger';

const logger = createLogger('CronPostbacks');

export const POST: APIRoute = withCronAuth(async (context) => {
  logger.info('Starting acquisition-ads retry sweep');
  const deps = await createAdsDepsForRequest(context.locals);
  const ads = await makeAcquisitionAds(deps);
  const result = await ads.retrySweep.retrySweep({ limit: 100 });
  logger.info('Acquisition-ads retry sweep complete', { processed: result.processed });
  return jsonResponse({ ok: true, ...result, timestamp: new Date().toISOString() });
});

export const GET: APIRoute = withCronAuth(async (context) => {
  return POST(context);
});
