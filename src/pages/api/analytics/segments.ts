import { defineRoute, ApiError } from '@/lib/api/define-route';
import { loadSegments } from '@/composition/analytics/make-diagnostics';
import {
  parseDiagnosticsRequest,
  resolveSegmentDimension,
  FunnelIdRequiredError,
} from '@/composition/analytics/diagnostics-request';
import type { SegmentsResponseDto } from '@/contracts/analytics-diagnostics';

export const GET = defineRoute(
  'GET /api/analytics/segments',
  { feature: 'ANALYTICS' },
  async ({ query }): Promise<SegmentsResponseDto> => {
    try {
      const { range, echo } = parseDiagnosticsRequest(query);
      const dimension = resolveSegmentDimension(query.get('dimension'));
      const segments = await loadSegments(range, dimension);
      return { success: true, dimension, segments, query: echo };
    } catch (err) {
      if (err instanceof FunnelIdRequiredError) throw new ApiError(400, err.message);
      throw err;
    }
  },
);
