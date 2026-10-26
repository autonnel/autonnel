import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';

// funnelId: null clears a manual assignment and hands the creative back to path attribution.
export const POST = defineRoute(
  'POST /api/ads/creatives/:id/assign',
  { feature: 'ANALYTICS' },
  async ({ input, params, locals }) => {
    const creativeId = String(params.id ?? '');
    if (!creativeId) throw new ApiError(400, 'creative id is required');
    const funnelId = (input as { funnelId?: string | null })?.funnelId ?? null;
    const ads = await makeAcquisitionAds(await createAdsDepsForRequest(locals));
    try {
      await ads.assignAdFunnel.assign({ creativeId, funnelId });
    } catch (err) {
      if (err instanceof Error && err.message === 'creative not found') throw new ApiError(404, 'Creative not found');
      if (err instanceof Error && err.message === 'funnel not found') throw new ApiError(400, 'Funnel not found');
      throw err;
    }
    return { ok: true as const };
  },
);
