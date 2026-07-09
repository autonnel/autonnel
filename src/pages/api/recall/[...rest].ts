import type { APIRoute } from 'astro';
import { makeRecall } from '../../../composition/make-recall';
import { handleCampaignDashboard } from '../../../modules/recall/infra/routes/campaign-dashboard.route';
import { createRecallDepsForRequest } from '../../../composition/make-recall-deps';
import { requireFeature } from '../../../modules/identity/published/principal';

export const ALL: APIRoute = async ({ request, params, locals }) => {
  const segments = (params.rest ?? '').split('/').filter(Boolean);
  const deps = await createRecallDepsForRequest(locals);
  const recall = makeRecall(deps);
  const body = request.method === 'GET' ? null : await request.json().catch(() => null);
  try {
    const res = await handleCampaignDashboard(
      { method: request.method, segments, body, principal: { requireFeature } },
      recall,
    );
    return new Response(JSON.stringify(res.body), {
      status: res.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    const status = (err as { httpStatus?: number }).httpStatus ?? 403;
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }
};
