import { defineRoute, ApiError } from '@/lib/api/define-route';
import { loadCheckoutMicroFunnel } from '@/composition/analytics/make-diagnostics';
import { parseDiagnosticsRequest, FunnelIdRequiredError } from '@/composition/analytics/diagnostics-request';
import type { PaymentsResponseDto, ProviderHealthDto } from '@/contracts/analytics-diagnostics';

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

export const GET = defineRoute(
  'GET /api/analytics/payments',
  { feature: 'ANALYTICS' },
  async ({ query }): Promise<PaymentsResponseDto> => {
    try {
      const { range, echo } = parseDiagnosticsRequest(query);
      const data = await loadCheckoutMicroFunnel(range);
      const providers: ProviderHealthDto[] = data.providers.map((p) => ({
        provider: p.provider,
        attempts: p.attempts,
        successes: p.successes,
        errors: p.errors,
        successRate: rate(p.successes, p.attempts),
        errorRate: rate(p.errors, p.attempts),
      }));
      return {
        success: true,
        microFunnel: data.stages,
        paymentErrors: data.paymentErrors,
        providers,
        query: echo,
      };
    } catch (err) {
      if (err instanceof FunnelIdRequiredError) throw new ApiError(400, err.message);
      throw err;
    }
  },
);
