import type { APIRoute } from 'astro';
import { withCronAuth, jsonResponse } from '@/lib/api-helpers';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';
import { createLogger } from '@/lib/logger';

const logger = createLogger('CronAdInsights');

export const POST: APIRoute = withCronAuth(async (context) => {
  logger.info('Starting ad insights sync sweep');
  const deps = await createAdsDepsForRequest(context.locals);
  const ads = await makeAcquisitionAds(deps);
  const result = await ads.syncInsights.syncAll();
  logger.info('Ad insights sync sweep complete', { ...result });
  // SyncSummary has its own numeric `ok` (accounts synced without error), which would silently
  // overwrite the wrapper's `ok: true` success flag if spread the way postbacks.ts spreads its
  // result -- that endpoint's { processed } shape has no colliding key, this one does.
  return jsonResponse({
    ok: true,
    connections: result.connections,
    synced: result.ok,
    failed: result.failed,
    skipped: result.skipped,
    timestamp: new Date().toISOString(),
  });
});

export const GET: APIRoute = withCronAuth(async (context) => {
  return POST(context);
});
