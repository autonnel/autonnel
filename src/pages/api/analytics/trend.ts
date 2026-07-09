import { defineRoute, ApiError } from '@/lib/api/define-route';
import { loadTrend } from '@/composition/analytics/make-diagnostics';
import { parseDiagnosticsRequest, FunnelIdRequiredError } from '@/composition/analytics/diagnostics-request';
import type { TrendResponseDto } from '@/contracts/analytics-diagnostics';

export const GET = defineRoute(
  'GET /api/analytics/trend',
  { feature: 'ANALYTICS' },
  async ({ query }): Promise<TrendResponseDto> => {
    try {
      const { range, echo } = parseDiagnosticsRequest(query);
      const { granularity, points, comparison } = await loadTrend(range);
      return { success: true, granularity, points, comparison, query: echo };
    } catch (err) {
      if (err instanceof FunnelIdRequiredError) throw new ApiError(400, err.message);
      throw err;
    }
  },
);
