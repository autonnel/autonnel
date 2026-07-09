import type { APIRoute } from 'astro';
import { authenticateExternalApi, jsonError, jsonResponse } from '@/lib/auth/externalApiAuth';
import { loadTrend } from '@/composition/analytics/make-diagnostics';
import { createLogger } from '@/lib/logger';
import { parseDiagnosticsRequest, FunnelIdRequiredError } from '@/composition/analytics/diagnostics-request';
import type { TrendResponseDto } from '@/contracts/analytics-diagnostics';

const logger = createLogger('AnalyticsTrend');

export const GET: APIRoute = async (context) => {
  const auth = await authenticateExternalApi(context);
  if (auth instanceof Response) return auth;

  const url = new URL(context.request.url);
  try {
    const { range, echo } = parseDiagnosticsRequest(url.searchParams);
    const { granularity, points, comparison } = await loadTrend(range);

    const body: TrendResponseDto = { success: true, granularity, points, comparison, query: echo };
    return jsonResponse(body);
  } catch (error) {
    if (error instanceof FunnelIdRequiredError) return jsonError(error.message, 400);
    logger.error('Fetch trend error', { error });
    return jsonError(error instanceof Error ? error.message : 'Failed to fetch trend', 500);
  }
};
