import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeFunnelDashboard } from '@/composition/make-funnel-dashboard';
import { FunnelNotFoundError } from '@/modules/funnel-dashboard/application/manage-funnels.service';
import { toFunnelDto } from '../index';

export const POST = defineRoute('POST /api/funnel/:funnelId/duplicate', { feature: 'FUNNELS', status: 201 }, async ({ params, input }) => {
  const { funnels } = makeFunnelDashboard();
  try {
    return toFunnelDto(await funnels.duplicate(params.funnelId!, { clonePages: input?.asArm === true }));
  } catch (err) {
    if (err instanceof FunnelNotFoundError) throw new ApiError(404, 'Funnel not found');
    throw err;
  }
});
