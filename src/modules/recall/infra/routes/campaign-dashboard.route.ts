import type { makeRecall } from '../../../../composition/make-recall';

type Recall = ReturnType<typeof makeRecall>;

export interface DashboardRequest {
  method: string;
  segments: string[];
  body: unknown;
  principal: { requireFeature(key: string): void };
}
export interface DashboardResponse {
  status: number;
  body: unknown;
}

const FEATURE = 'SETTINGS_RECALL';

export async function handleCampaignDashboard(req: DashboardRequest, recall: Recall): Promise<DashboardResponse> {
  req.principal.requireFeature(FEATURE);
  const [resource] = req.segments;

  if (resource === 'campaign') {
    if (req.method === 'GET') return { status: 200, body: await recall.manageCampaign.get() };
    if (req.method === 'PUT') return { status: 200, body: await recall.manageCampaign.put(req.body as any) };
  }
  if (resource === 'suppression') {
    if (req.method === 'GET') return { status: 200, body: await recall.manageSuppression.list() };
    if (req.method === 'POST') {
      const { scope, subjectKey } = req.body as { scope: any; subjectKey: string };
      return { status: 200, body: await recall.manageSuppression.block(scope, subjectKey) };
    }
    if (req.method === 'DELETE') {
      const { scope, subjectKey } = req.body as { scope: any; subjectKey: string };
      await recall.manageSuppression.unblock(scope, subjectKey);
      return { status: 200, body: { ok: true } };
    }
  }
  return { status: 404, body: { error: 'not_found' } };
}
