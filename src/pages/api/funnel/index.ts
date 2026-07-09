import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeFunnelDashboard } from '@/composition/make-funnel-dashboard';
import { createFunnelWithDefaults } from '@/composition/create-funnel-with-defaults';
import type { FunnelSummary } from '@/modules/funnel-dashboard/application/ports';
import type { FunnelDto } from '@/contracts/funnel';

export function toFunnelDto(f: FunnelSummary): FunnelDto {
  return {
    id: f.id,
    name: f.name,
    description: f.description,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

export const GET = defineRoute('GET /api/funnel', { feature: 'FUNNELS' }, async () => {
  const { funnels } = makeFunnelDashboard();
  const rows = await funnels.list();
  return { funnels: rows.map(toFunnelDto) };
});

export const POST = defineRoute('POST /api/funnel', { feature: 'FUNNELS', status: 201 }, async ({ input, locals }) => {
  if (!input?.name) throw new ApiError(400, 'Name is required');
  const created = await createFunnelWithDefaults({ name: input.name, description: input.description, locals });
  return toFunnelDto(created);
});
