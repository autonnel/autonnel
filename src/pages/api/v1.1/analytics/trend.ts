import type { APIRoute } from 'astro';
import { jsonError, jsonResponse } from '@/lib/auth/externalApiAuth';
import { requireFeature } from '@/modules/identity/published/principal';
import { withApiPrincipal } from '@/composition/external-auth';
import { loadTrend } from '@/composition/analytics/make-diagnostics';
import { createLogger } from '@/lib/logger';
import { parseDiagnosticsRequest, FunnelIdRequiredError } from '@/composition/analytics/diagnostics-request';
import type { TrendResponseDto } from '@/contracts/analytics-diagnostics';

const logger = createLogger('AnalyticsTrend');

export const GET: APIRoute = (context) =>
  withApiPrincipal(context, async () => {
    requireFeature('ANALYTICS');
    const url = new URL(context.request.url);
    try {
      const { range, echo } = parseDiagnosticsRequest(url.searchParams);
      const { granularity, points, comparison } = await loadTrend(range);

      const body: TrendResponseDto = { success: true, granularity, points, comparison, query: echo };
      return jsonResponse(body);
    } catch (error) {
      if (error instanceof FunnelIdRequiredError) return jsonError(error.message, 400);
      logger.error('Fetch trend error', { error });
      return jsonError('Failed to fetch trend', 500);
    }
  });
