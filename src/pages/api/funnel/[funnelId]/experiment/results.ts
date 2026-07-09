import { defineRoute } from '@/lib/api/define-route';
import { makeFunnelDashboard } from '@/composition/make-funnel-dashboard';

export const GET = defineRoute(
  'GET /api/funnel/:funnelId/experiment/results',
  { feature: 'FUNNELS' },
  async ({ params }) => {
    const { results } = makeFunnelDashboard();
    return results.get(params.funnelId!);
  },
);
