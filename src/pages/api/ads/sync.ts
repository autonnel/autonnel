import type { APIRoute } from 'astro';
import { withAuthAnyOf, jsonResponse, jsonError } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/rbac';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { enforceRateLimit, rateLimitKey, RATE_LIMITS } from '@/lib/adapters/rate-limit';
import { beginManualAdInsightsSync } from '@/composition/trigger-manual-ad-insights-sync';
import { createLogger } from '@/lib/logger';

const log = createLogger('AdsManualSync');

interface SyncRequestBody {
  connectionId?: unknown;
}

// The cache adapters expose no "remaining TTL" read, so when the shared sync lock is already held
// (see trigger-manual-ad-insights-sync.ts) this is a conservative "try again soon" hint rather than
// a precise countdown. The cooldown 429 below is not a precise countdown either on every backend:
// CacheRateLimiter.consume (src/lib/adapters/rate-limit/cache-rate-limiter.ts) returns the FULL
// configured window on any adapter with incrWithTtl -- which is Redis, i.e. whenever REDIS_URL or
// REDIS_HOST is set -- and only computes true remaining time on the non-atomic memory/Cloudflare
// KV fallback path. So neither retryAfterSeconds value should be presented to a user as an exact
// countdown; both are "try again around now" hints, one just usually tighter than the other.
const BUSY_RETRY_SECONDS = 30;

function retryResponse(retryAfterSeconds: number, reason: 'cooldown' | 'busy'): Response {
  const seconds = Math.max(1, Math.ceil(retryAfterSeconds));
  return new Response(JSON.stringify({ retryAfterSeconds: seconds, reason }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(seconds) },
  });
}

// POST { connectionId?: string } -> { started: true, scope: 'all' | 'connection' }.
// Returns immediately; the actual sync runs in the background (see trigger-manual-ad-insights-sync.ts).
// Poll GET /api/ads/sync/status for the outcome.
// Gated on ANALYTICS or SETTINGS_ADS: this endpoint is a legitimate entry point from both the
// analytics dashboard's global refresh button and the per-connection refresh button on
// Settings -> Ads, which does not otherwise carry ANALYTICS.
export const POST: APIRoute = withAuthAnyOf([FEATURES.ANALYTICS, FEATURES.SETTINGS_ADS], async ({ request, locals }) => {
  let body: SyncRequestBody = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const connectionId =
    typeof body.connectionId === 'string' && body.connectionId.length > 0 ? body.connectionId : undefined;

  if (connectionId) {
    // Tenant-scoped prisma injects tenantId into every read's where clause (see
    // prisma-tenant-extension.ts), so a foreign or unknown id both resolve to null here -- the 404
    // below must stay generic either way, never revealing which case it was.
    const owned = await getTenantPrisma().adAccountConnection.findFirst({
      where: { id: connectionId },
      select: { id: true },
    });
    if (!owned) return jsonError('Not found', 404);
  }

  const rate = await enforceRateLimit(rateLimitKey('ads:insights:manual'), RATE_LIMITS.ADS_INSIGHTS_MANUAL_REFRESH);
  if (!rate.allowed) return retryResponse(rate.retryAfterSeconds, 'cooldown');

  const started = await beginManualAdInsightsSync({ locals, connectionId });
  if (!started) {
    log.info('manual ad insights sync request found a sync already in progress', { connectionId });
    return retryResponse(BUSY_RETRY_SECONDS, 'busy');
  }

  return jsonResponse({ started: true, scope: connectionId ? 'connection' : 'all' });
});
