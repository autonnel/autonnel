import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeFunnelDashboard } from '@/composition/make-funnel-dashboard';
import { ExperimentNotFoundError } from '@/modules/funnel-dashboard/application/manage-experiment.service';
import { toExperimentDto } from '@/lib/dashboard/experiment-dto';

export const POST = defineRoute('POST /api/funnel/:funnelId/experiment/arm', { feature: 'FUNNELS', status: 201 }, async ({ params, input }) => {
  if (!input?.name || input.weight === undefined) throw new ApiError(400, 'name and weight are required');
  const { experiments } = makeFunnelDashboard();
  try {
    return toExperimentDto(
      await experiments.addArm(params.funnelId!, {
        name: input.name,
        weight: input.weight,
        targetFunnelId: input.targetFunnelId,
        targetPageId: input.targetPageId,
      }),
    );
  } catch (err) {
    if (err instanceof ExperimentNotFoundError) throw new ApiError(404, 'Experiment not found');
    throw err;
  }
});

export const PUT = defineRoute('PUT /api/funnel/:funnelId/experiment/arm', { feature: 'FUNNELS' }, async ({ params, input }) => {
  if (!input?.armId) throw new ApiError(400, 'armId is required');
  const { experiments } = makeFunnelDashboard();
  try {
    return toExperimentDto(
      await experiments.updateArm(params.funnelId!, { armId: input.armId, name: input.name, weight: input.weight }),
    );
  } catch (err) {
    if (err instanceof ExperimentNotFoundError) throw new ApiError(404, 'Arm not found');
    throw err;
  }
});

export const DELETE = defineRoute('DELETE /api/funnel/:funnelId/experiment/arm', { feature: 'FUNNELS' }, async ({ params, query }) => {
  const armId = query.get('armId');
  if (!armId) throw new ApiError(400, 'armId is required');
  const { experiments } = makeFunnelDashboard();
  try {
    return toExperimentDto(await experiments.removeArm(params.funnelId!, armId));
  } catch (err) {
    if (err instanceof ExperimentNotFoundError) throw new ApiError(404, 'Arm not found');
    throw err;
  }
});
