import type { APIRoute } from 'astro';
import { authenticateExternalApi, jsonError, jsonResponse } from '@/lib/auth/externalApiAuth';
import { loadCheckoutMicroFunnel } from '@/composition/analytics/make-diagnostics';
import { createLogger } from '@/lib/logger';
import { parseDiagnosticsRequest, FunnelIdRequiredError } from '@/composition/analytics/diagnostics-request';
import type { PaymentsResponseDto, ProviderHealthDto } from '@/contracts/analytics-diagnostics';

const logger = createLogger('AnalyticsPayments');

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

export const GET: APIRoute = async (context) => {
  const auth = await authenticateExternalApi(context);
  if (auth instanceof Response) return auth;

  const url = new URL(context.request.url);
  try {
    const { range, echo } = parseDiagnosticsRequest(url.searchParams);
    const data = await loadCheckoutMicroFunnel(range);

    const providers: ProviderHealthDto[] = data.providers.map((p) => ({
      provider: p.provider,
      attempts: p.attempts,
      successes: p.successes,
      errors: p.errors,
      successRate: rate(p.successes, p.attempts),
      errorRate: rate(p.errors, p.attempts),
    }));

    const body: PaymentsResponseDto = {
      success: true,
      microFunnel: data.stages,
      paymentErrors: data.paymentErrors,
      providers,
      query: echo,
    };
    return jsonResponse(body);
  } catch (error) {
    if (error instanceof FunnelIdRequiredError) return jsonError(error.message, 400);
    logger.error('Fetch payment health error', { error });
    return jsonError(error instanceof Error ? error.message : 'Failed to fetch payment health', 500);
  }
};
