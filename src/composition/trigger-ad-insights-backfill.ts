import { runWithRequestDb, disposeRequestDb } from '@/lib/db';
import { runWithTenant, getCurrentTenantId } from '@/lib/tenant/context';
import { BACKFILL_DAYS } from '@/modules/acquisition-ads/application/sync-ad-insights.service';
import { createLogger } from '@/lib/logger';
import { makeAcquisitionAds } from './make-acquisition-ads';
import { createAdsDepsForRequest } from './make-ads-deps';

const log = createLogger('AdsInsightsBackfill');

interface CfLocals {
  cfContext?: { waitUntil(p: Promise<unknown>): void };
}

// First connect: pull BACKFILL_DAYS per newly discovered ad account so the reconciliation page
// is not empty on day one. Connecting creates one AdAccountConnection per discovered account, so
// this iterates the whole list; one account's failure must not stop the others.
//
// Fires after the OAuth callback has already built its redirect response, on its OWN request-db
// scope (the callback's pool is disposed the instant it returns), the same waitUntil-or-fire pattern
// used by enqueueMediaGeneration -- see src/composition/make-media-generation.ts. Deliberately
// outside the hourly ads.insights sweep so it can't consume that sweep's lock TTL.
export function triggerFirstConnectBackfill(locals: unknown, platform: string, connectionIds: string[]): void {
  if (connectionIds.length === 0) return;

  const tenantId = getCurrentTenantId();
  const task = runWithRequestDb(async () => {
    try {
      await runWithTenant(tenantId, async () => {
        const ads = await makeAcquisitionAds(await createAdsDepsForRequest());
        for (const connectionId of connectionIds) {
          try {
            const result = await ads.syncInsights.syncConnection({ connectionId, windowDays: BACKFILL_DAYS });
            if (result.status === 'FAILED') {
              log.error('first-connect backfill failed for one connection', {
                connectionId,
                error: result.error,
              });
            }
          } catch (err) {
            // syncConnection normally swallows per-account errors into a FAILED result (see the
            // branch above); this catch only covers something escaping that boundary, e.g. a
            // dependency construction failure between connections.
            log.error('first-connect backfill threw for one connection', { connectionId, error: err });
          }
        }
      });
    } finally {
      await disposeRequestDb();
    }
  })
    // Wraps the WHOLE task above, not just the per-connection loop: createAdsDepsForRequest /
    // makeAcquisitionAds can throw before the loop ever starts, and that failure must not escape
    // as a rejection of `task`. On Workers ctx.waitUntil would absorb it, but the else-branch
    // below is `void task`, which attaches no rejection handler -- and that branch runs on the
    // Docker/Node production runtime (node dist/server/entry.mjs), not merely in dev. Node has
    // terminated the process on unhandled rejections by default since v15, so this catch is load
    // bearing, not defensive. The hourly ads.insights sweep will still pick these accounts up.
    .catch((err) => {
      log.error('first-connect backfill failed before syncing any connection', {
        platform,
        connectionIds,
        error: err,
      });
    });

  const waitUntil = (locals as CfLocals)?.cfContext?.waitUntil;
  if (waitUntil) waitUntil.call((locals as CfLocals).cfContext, task);
  else void task; // Docker/Node production runtime (no cfContext): fire-and-forget is safe because the .catch above guarantees `task` never rejects.
}
