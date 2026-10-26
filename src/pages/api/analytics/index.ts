import { defineRoute } from '@/lib/api/define-route';
import { loadStatsData } from '@/composition/analytics/make-stats';
import { convertDateRangeToUtc } from '@/lib/utils';
import { queryAdFunnelTotals } from '@/lib/dashboard/ads-reconciliation-queries';
import { createLogger } from '@/lib/logger';
import type { StatsResponseDto } from '@/contracts/stats';

const logger = createLogger('api:analytics');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_DAYS = 30;

function isoDate(date: Date) {
  return date.toISOString().split('T')[0];
}

export const GET = defineRoute('GET /api/analytics', { feature: 'ANALYTICS' }, async ({ query }): Promise<StatsResponseDto> => {
  const now = new Date();
  const endStr = query.get('endDate') || isoDate(now);
  const startStr = query.get('startDate') || isoDate(new Date(now.getTime() - DEFAULT_LOOKBACK_DAYS * DAY_MS));
  const timezone = query.get('timezone') || 'UTC';
  const funnelId = query.get('funnelId') || undefined;

  const { startDate, endDate } = convertDateRangeToUtc(startStr, endStr, timezone);

  const data = await loadStatsData({
    funnelId,
    fromBucketKey: startDate.toISOString(),
    toBucketKey: endDate.toISOString(),
  });

  // Ad metrics are stored on the AD ACCOUNT's own calendar day and are never converted, so they
  // take the operator's picked day strings directly rather than the UTC instants above. A failure
  // here must not take down the whole stats response: the onsite funnel is the primary payload and
  // the ad stages are an enrichment.
  const adTotals = await queryAdFunnelTotals(startStr, endStr).catch((error) => {
    logger.error('ad funnel totals failed to load; serving onsite stats only', { error });
    return [];
  });
  const adByFunnel = new Map(adTotals.map((r) => [r.funnelId, r]));
  const enriched = data.map((item) => {
    const ad = adByFunnel.get(item.funnelId);
    return ad
      ? {
          ...item,
          ad: {
            impressions: ad.impressions,
            linkClicks: ad.linkClicks,
            initiateCheckout: ad.initiateCheckout,
            conversions: ad.conversions,
            platformTimezones: ad.platformTimezones,
          },
        }
      : item;
  });

  return {
    success: true,
    data: enriched,
    query: {
      funnelId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      timezone,
    },
  };
});
