import type { APIRoute } from 'astro';
import { authenticateExternalApi, jsonError, jsonResponse } from '@/lib/auth/externalApiAuth';
import { loadStatsData } from '@/composition/analytics/make-stats';
import { convertDateRangeToUtc } from '@/lib/utils';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ExternalStats');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_DAYS = 30;

function isoDate(date: Date) {
  return date.toISOString().split('T')[0];
}

export const GET: APIRoute = async (context) => {
  const auth = await authenticateExternalApi(context);
  if (auth instanceof Response) return auth;

  const url = new URL(context.request.url);

  try {
    const now = new Date();
    const endStr = url.searchParams.get('endDate') || isoDate(now);
    const startStr =
      url.searchParams.get('startDate') || isoDate(new Date(now.getTime() - DEFAULT_LOOKBACK_DAYS * DAY_MS));
    const timezone = url.searchParams.get('timezone') || 'UTC';
    const funnelId = url.searchParams.get('funnelId') || undefined;

    const { startDate, endDate } = convertDateRangeToUtc(startStr, endStr, timezone);

    const data = await loadStatsData({
      funnelId,
      fromBucketKey: startDate.toISOString(),
      toBucketKey: endDate.toISOString(),
    });

    return jsonResponse({
      success: true,
      data,
      query: {
        funnelId: funnelId ?? null,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timezone,
      },
    });
  } catch (error) {
    logger.error('Fetch statistics error', { error });
    return jsonError(error instanceof Error ? error.message : 'Failed to fetch statistics', 500);
  }
};
