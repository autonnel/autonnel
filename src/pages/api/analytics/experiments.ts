import { defineRoute, ApiError } from '@/lib/api/define-route';
import { loadExperimentArms } from '@/composition/analytics/make-diagnostics';
import { parseDiagnosticsRequest, FunnelIdRequiredError } from '@/composition/analytics/diagnostics-request';
import { conversionRate } from '@/lib/stats/diagnostics';
import type { ExperimentArmDto, ExperimentsResponseDto } from '@/contracts/analytics-diagnostics';

export const GET = defineRoute(
  'GET /api/analytics/experiments',
  { feature: 'ANALYTICS' },
  async ({ query }): Promise<ExperimentsResponseDto> => {
    try {
      const { range, echo } = parseDiagnosticsRequest(query);
      const rows = await loadExperimentArms(range);
      const arms: ExperimentArmDto[] = rows.map((r) => ({
        experimentId: r.experimentId,
        armId: r.armId,
        key: `${r.experimentId}:${r.armId}`,
        label: `${r.experimentId} / ${r.armId}`,
        visitors: r.visitors,
        orders: r.orders,
        revenue: r.revenueMinor / 100,
        cvr: conversionRate(r.convertingVisitors, r.visitors),
      }));
      return { success: true, arms, query: echo };
    } catch (err) {
      if (err instanceof FunnelIdRequiredError) throw new ApiError(400, err.message);
      throw err;
    }
  },
);
