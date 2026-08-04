import type { APIRoute } from 'astro';
import { jsonError, jsonResponse } from '@/lib/auth/externalApiAuth';
import { requireFeature } from '@/modules/identity/published/principal';
import { withApiPrincipal } from '@/composition/external-auth';
import { loadSegments } from '@/composition/analytics/make-diagnostics';
import { createLogger } from '@/lib/logger';
import {
  parseDiagnosticsRequest,
  resolveSegmentDimension,
  FunnelIdRequiredError,
} from '@/composition/analytics/diagnostics-request';
import type { SegmentsResponseDto } from '@/contracts/analytics-diagnostics';

const logger = createLogger('AnalyticsSegments');

export const GET: APIRoute = (context) =>
  withApiPrincipal(context, async () => {
    requireFeature('ANALYTICS');
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
      return jsonError('Failed to fetch segments', 500);
    }
  });
