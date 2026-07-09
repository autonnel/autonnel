import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { authoringDepsFromLocals } from '@/composition/authoring-runtime';
import { PrismaFunnelRepository } from '@/modules/authoring/infra/prisma/funnel-repository';
import { FunnelReachabilityService } from '@/modules/authoring/domain/services/funnel-reachability-service';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FunnelValidateRoute');

export const GET: APIRoute = async ({ params, locals }) => {
  await requireFeature('FUNNELS');
  try {
    const { db } = authoringDepsFromLocals(locals);
    const funnels = new PrismaFunnelRepository(db);
    const funnel = await funnels.load(params.funnelId!);
    if (!funnel) {
      return new Response(JSON.stringify({ error: 'Funnel not found' }), { status: 404 });
    }
    if (!funnel.entryStepSlug) {
      return new Response(
        JSON.stringify({ ok: false, unreachable: [], issues: ['Funnel has no entry step'] }),
        { status: 200 },
      );
    }
    const result = new FunnelReachabilityService().analyze({
      entryStepSlug: funnel.entryStepSlug,
      steps: funnel.steps.map((s) => s.stepSlug),
      transitions: [...funnel.transitions],
    });
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    logger.error('Funnel validate failed', { error, funnelId: params.funnelId });
    return new Response(JSON.stringify({ error: 'Funnel validate failed' }), { status: 400 });
  }
};
