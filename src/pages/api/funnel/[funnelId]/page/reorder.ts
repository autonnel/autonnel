import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FunnelReorderRoute');

export const POST: APIRoute = async ({ request, params }) => {
  await requireFeature('FUNNELS');
  try {
    await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }
  logger.info('Funnel step reorder requested (use-case pending)', { funnelId: params.funnelId });
  return new Response(JSON.stringify({ error: 'Not implemented' }), { status: 501 });
};
