import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeFunnelDashboard } from '@/composition/make-funnel-dashboard';
import { FunnelNotFoundError } from '@/modules/funnel-dashboard/application/manage-funnels.service';
import { toFunnelDto } from './index';

export const GET = defineRoute('GET /api/funnel/:funnelId', { feature: 'FUNNELS' }, async ({ params }) => {
  const { funnels } = makeFunnelDashboard();
  try {
    return toFunnelDto(await funnels.get(params.funnelId!));
  } catch (err) {
    if (err instanceof FunnelNotFoundError) throw new ApiError(404, 'Funnel not found');
    throw err;
  }
});

export const PUT = defineRoute('PUT /api/funnel/:funnelId', { feature: 'FUNNELS' }, async ({ params, input }) => {
  const { funnels } = makeFunnelDashboard();
  try {
    return toFunnelDto(await funnels.update(params.funnelId!, input ?? {}));
  } catch (err) {
    if (err instanceof FunnelNotFoundError) throw new ApiError(404, 'Funnel not found');
    throw err;
  }
});

export const DELETE = defineRoute('DELETE /api/funnel/:funnelId', { feature: 'FUNNELS' }, async ({ params }) => {
  const { funnels } = makeFunnelDashboard();
  try {
    await funnels.remove(params.funnelId!);
    return { success: true as const };
  } catch (err) {
    if (err instanceof FunnelNotFoundError) throw new ApiError(404, 'Funnel not found');
    throw err;
  }
});
