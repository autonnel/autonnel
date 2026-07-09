import { defineRoute } from '@/lib/api/define-route';
import { loadStatsData } from '@/composition/analytics/make-stats';
import { convertDateRangeToUtc } from '@/lib/utils';
import type { StatsResponseDto } from '@/contracts/stats';

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

  return {
    success: true,
    data,
    query: {
      funnelId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      timezone,
    },
  };
});
