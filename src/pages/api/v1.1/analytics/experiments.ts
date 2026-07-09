import type { APIRoute } from 'astro';
import { authenticateExternalApi, jsonError, jsonResponse } from '@/lib/auth/externalApiAuth';
import { loadExperimentArms } from '@/composition/analytics/make-diagnostics';
import { createLogger } from '@/lib/logger';
import { parseDiagnosticsRequest, FunnelIdRequiredError } from '@/composition/analytics/diagnostics-request';
import { conversionRate } from '@/lib/stats/diagnostics';
import type { ExperimentArmDto, ExperimentsResponseDto } from '@/contracts/analytics-diagnostics';

const logger = createLogger('AnalyticsExperiments');

export const GET: APIRoute = async (context) => {
  const auth = await authenticateExternalApi(context);
  if (auth instanceof Response) return auth;

  const url = new URL(context.request.url);
  try {
    const { range, echo } = parseDiagnosticsRequest(url.searchParams);
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

    const body: ExperimentsResponseDto = { success: true, arms, query: echo };
    return jsonResponse(body);
  } catch (error) {
    if (error instanceof FunnelIdRequiredError) return jsonError(error.message, 400);
    logger.error('Fetch experiments error', { error });
    return jsonError(error instanceof Error ? error.message : 'Failed to fetch experiments', 500);
  }
};
