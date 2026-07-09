import type { APIRoute } from 'astro';
import { authenticateExternalApi, jsonError, jsonResponse } from '@/lib/auth/externalApiAuth';
import { loadSegments } from '@/composition/analytics/make-diagnostics';
import { createLogger } from '@/lib/logger';
import {
  parseDiagnosticsRequest,
  resolveSegmentDimension,
  FunnelIdRequiredError,
} from '@/composition/analytics/diagnostics-request';
import type { SegmentsResponseDto } from '@/contracts/analytics-diagnostics';

const logger = createLogger('AnalyticsSegments');

export const GET: APIRoute = async (context) => {
  const auth = await authenticateExternalApi(context);
  if (auth instanceof Response) return auth;

  const url = new URL(context.request.url);
  try {
    const { range, echo } = parseDiagnosticsRequest(url.searchParams);
    const dimension = resolveSegmentDimension(url.searchParams.get('dimension'));
    const segments = await loadSegments(range, dimension);

    const body: SegmentsResponseDto = { success: true, dimension, segments, query: echo };
    return jsonResponse(body);
  } catch (error) {
    if (error instanceof FunnelIdRequiredError) return jsonError(error.message, 400);
    logger.error('Fetch segments error', { error });
    return jsonError(error instanceof Error ? error.message : 'Failed to fetch segments', 500);
  }
};
