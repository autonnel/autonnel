import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeFunnelDashboard } from '@/composition/make-funnel-dashboard';
import { FunnelScriptNotFoundError } from '@/modules/funnel-dashboard/application/manage-funnel-scripts.service';
import type { FunnelScript } from '@/modules/funnel-dashboard/domain/funnel-script';
import type { FunnelScriptDto } from '@/contracts/funnel';

function toDto(s: FunnelScript): FunnelScriptDto {
  return { id: s.id, name: s.name, position: s.position, content: s.content, isActive: s.isActive, order: s.order };
}

export const GET = defineRoute('GET /api/funnel/:funnelId/custom-code', { feature: 'FUNNELS' }, async ({ params }) => {
  const { scripts } = makeFunnelDashboard();
  const rows = await scripts.list(params.funnelId!);
  return rows.map(toDto);
});

export const POST = defineRoute('POST /api/funnel/:funnelId/custom-code', { feature: 'FUNNELS', status: 201 }, async ({ params, input }) => {
  if (!input) throw new ApiError(400, 'Invalid request body');
  const { scripts } = makeFunnelDashboard();
  const created = await scripts.create({
    funnelId: params.funnelId!,
    name: input.name,
    position: input.position,
    content: input.content,
    isActive: input.isActive,
    order: input.order,
  });
  return toDto(created);
});

export const PUT = defineRoute('PUT /api/funnel/:funnelId/custom-code', { feature: 'FUNNELS' }, async ({ input }) => {
  if (!input?.scriptId) throw new ApiError(400, 'scriptId is required');
  const { scripts } = makeFunnelDashboard();
  try {
    const updated = await scripts.update(input.scriptId, {
      name: input.name,
      position: input.position,
      content: input.content,
      isActive: input.isActive,
      order: input.order,
    });
    return toDto(updated);
  } catch (err) {
    if (err instanceof FunnelScriptNotFoundError) throw new ApiError(404, 'Script not found');
    throw err;
  }
});

export const DELETE = defineRoute('DELETE /api/funnel/:funnelId/custom-code', { feature: 'FUNNELS' }, async ({ query }) => {
  const scriptId = query.get('scriptId');
  if (!scriptId) throw new ApiError(400, 'scriptId is required');
  const { scripts } = makeFunnelDashboard();
  try {
    await scripts.remove(scriptId);
    return { success: true as const };
  } catch (err) {
    if (err instanceof FunnelScriptNotFoundError) throw new ApiError(404, 'Script not found');
    throw err;
  }
});
