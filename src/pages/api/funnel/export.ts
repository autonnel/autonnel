// Non-JSON response; stays a plain APIRoute outside the typed defineRoute contract.
import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { makeFunnelDashboard } from '@/composition/make-funnel-dashboard';
import { toCsv } from '@/lib/dashboard/overview-helpers';

export const GET: APIRoute = async ({ request }) => {
  await requireFeature('FUNNELS');
  const url = new URL(request.url);
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();
  if (format !== 'csv') {
    return new Response(JSON.stringify({ error: 'Only csv format is supported' }), { status: 400 });
  }

  const { funnels } = makeFunnelDashboard();
  const rows = (await funnels.list()).map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description ?? '',
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  }));

  const csv = toCsv(rows, ['id', 'name', 'description', 'createdAt', 'updatedAt']);
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="funnels-${Date.now()}.csv"`,
    },
  });
};
