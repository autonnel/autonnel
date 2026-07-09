import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeFunnelDashboard } from '@/composition/make-funnel-dashboard';
import {
  ExperimentNotFoundError,
  ExperimentExistsError,
} from '@/modules/funnel-dashboard/application/manage-experiment.service';
import { toExperimentDto } from '@/lib/dashboard/experiment-dto';

export const GET = defineRoute('GET /api/funnel/:funnelId/experiment', { feature: 'FUNNELS' }, async ({ params }) => {
  const { experiments } = makeFunnelDashboard();
  const found = await experiments.get(params.funnelId!);
  return found ? toExperimentDto(found) : null;
});

export const POST = defineRoute('POST /api/funnel/:funnelId/experiment', { feature: 'FUNNELS', status: 201 }, async ({ params, input }) => {
  if (!input?.name || !input.goal) throw new ApiError(400, 'name and goal are required');
  const { experiments } = makeFunnelDashboard();
  try {
    return toExperimentDto(await experiments.create(params.funnelId!, { name: input.name, goal: input.goal }));
  } catch (err) {
    if (err instanceof ExperimentExistsError) throw new ApiError(409, 'An experiment already exists for this funnel');
    throw err;
  }
});

export const PUT = defineRoute('PUT /api/funnel/:funnelId/experiment', { feature: 'FUNNELS' }, async ({ params, input }) => {
  if (!input) throw new ApiError(400, 'Invalid request body');
  const { experiments } = makeFunnelDashboard();
  try {
    return toExperimentDto(
      await experiments.update(params.funnelId!, {
        name: input.name,
        goal: input.goal,
        action: input.action,
        winnerArmId: input.winnerArmId,
      }),
    );
  } catch (err) {
    if (err instanceof ExperimentNotFoundError) throw new ApiError(404, 'Experiment not found');
    throw err;
  }
});

export const DELETE = defineRoute('DELETE /api/funnel/:funnelId/experiment', { feature: 'FUNNELS' }, async ({ params }) => {
  const { experiments } = makeFunnelDashboard();
  try {
    await experiments.remove(params.funnelId!);
    return { success: true as const };
  } catch (err) {
    if (err instanceof ExperimentNotFoundError) throw new ApiError(404, 'Experiment not found');
    throw err;
  }
});
