import { runWithRequestDb, disposeRequestDb } from '@/lib/db';
import { runWithTenant, getCurrentTenantId } from '@/lib/tenant/context';
import { getCache } from '@/lib/adapters/cache';
import { CRON_JOBS } from '@/lib/cron/catalog';
import { SYNC_WINDOW_DAYS } from '@/modules/acquisition-ads/application/sync-ad-insights.service';
import { createLogger } from '@/lib/logger';
import { makeAcquisitionAds } from './make-acquisition-ads';
import { createAdsDepsForRequest } from './make-ads-deps';

const log = createLogger('AdsInsightsManualSync');

interface CfLocals {
  cfContext?: { waitUntil(p: Promise<unknown>): void };
}

export interface BeginManualSyncInput {
  locals: unknown;
  connectionId?: string;
}

// Reuses the EXACT lock key src/lib/cron/run-sweep.ts derives for the "ads.insights" job
// (`cron:lock:${name}`). Deliberate: a manual refresh and the hourly sweep must never touch the
// same account at once (duplicate calls into rate-limited ad platform APIs), and one shared mutex
// gets both directions of exclusion for free -- manual-vs-cron AND manual-vs-manual -- without a
// second lock/TTL pair to keep in sync. This does NOT touch the sweep's own `cron:last:ads.insights`
// interval marker, so a tick that loses the race is simply skipped; the sweep's own schedule
// (and eventual catch-up next hour) is unaffected by manual runs.
// Today this key is also GLOBAL rather than per-tenant, which matches the granularity the sweep
// itself already has: src/cf-worker.ts runs the whole scheduled tick under a single
// runWithTenant(DEFAULT_TENANT, ...) with no per-tenant fan-out. If that ever changes, whoever
// makes the sweep per-tenant should key this lock the same new way.
const SHARED_LOCK_KEY = 'cron:lock:ads.insights';
const SHARED_LOCK_TTL_SECONDS = CRON_JOBS.find((j) => j.name === 'ads.insights')?.lockTtlSeconds ?? 3600;

// Attempts to take the shared lock and, if successful, runs the sync in the background on its own
// request-db scope -- same waitUntil-or-fire pattern as triggerFirstConnectBackfill (see
// src/composition/trigger-ad-insights-backfill.ts) -- so the POST handler can return immediately
// instead of blocking on a multi-account sync. Returns false, having started nothing, when the
// lock is already held (by the cron sweep or another manual refresh); the caller must not report
// success in that case.
export async function beginManualAdInsightsSync(input: BeginManualSyncInput): Promise<boolean> {
  const cache = getCache();
  // Every CacheAdapter's acquireLock/releaseLock (memory.ts, redis.ts, cloudflare-kv.ts) is a
  // plain advisory lock: whoever calls releaseLock deletes the key unconditionally, with no
  // holder token/fencing to check it is still the current holder's own lock. Before this file,
  // cron:lock:ads.insights had exactly one caller (the hourly sweep), so a stale release could
  // only ever race a future tick of that same job. This is now a SECOND independent caller of the
  // identical key. If this background sync ever ran past SHARED_LOCK_TTL_SECONDS (currently the
  // sweep's own 3600s), the lock would expire and could be re-acquired by a fresh run (cron or
  // another manual trigger); this call's own `.finally(() => cache.releaseLock(...))` would then
  // delete THAT run's lock instead of its own, letting a third run start concurrently. This is an
  // inherited limitation of the shared primitive, not something introduced here, and fencing it
  // (e.g. a holder token compared on release) is a change to CacheAdapter itself, out of scope.
  const locked = await cache.acquireLock(SHARED_LOCK_KEY, SHARED_LOCK_TTL_SECONDS);
  if (!locked) return false;

  const tenantId = getCurrentTenantId();
  const connectionId = input.connectionId;

  const task = runWithRequestDb(async () => {
    try {
      await runWithTenant(tenantId, async () => {
        const ads = await makeAcquisitionAds(await createAdsDepsForRequest());
        if (connectionId) {
          const result = await ads.syncInsights.syncConnection({ connectionId, windowDays: SYNC_WINDOW_DAYS });
          if (result.status === 'FAILED') {
            log.error('manual ad insights sync failed for one connection', { tenantId, connectionId, error: result.error });
          }
        } else {
          const summary = await ads.syncInsights.syncAll();
          log.info('manual ad insights sync complete', { tenantId, ...summary });
        }
      });
    } finally {
      await disposeRequestDb();
    }
  })
    // Wraps the WHOLE task, not just the sync call: createAdsDepsForRequest/makeAcquisitionAds
    // can throw before syncInsights is ever reached, and that must not escape as an unhandled
    // rejection on the Node/Docker production runtime (see trigger-ad-insights-backfill.ts for
    // the same reasoning -- this file mirrors it deliberately).
    .catch((err) => {
      log.error('manual ad insights sync failed before completing', { tenantId, connectionId, error: err });
    })
    // Always release, success or failure, so the next cron tick or manual click is not blocked
    // for the full TTL. releaseLock swallows its own errors (see cache adapters), so this never
    // turns into a new rejection.
    .finally(() => cache.releaseLock(SHARED_LOCK_KEY));

  const waitUntil = (input.locals as CfLocals)?.cfContext?.waitUntil;
  if (waitUntil) waitUntil.call((input.locals as CfLocals).cfContext, task);
  else void task; // Docker/Node production runtime: safe fire-and-forget, task can never reject.

  return true;
}
