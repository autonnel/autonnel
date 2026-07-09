import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';
import type { AdTestEventResponseDto } from '@/contracts/ads';

export const POST = defineRoute(
  'POST /api/marketing/:id/test-event',
  { feature: 'MARKETING' },
  async ({ input, locals }): Promise<AdTestEventResponseDto> => {
    const testEventCode = input?.testEventCode;
    if (testEventCode !== undefined && (typeof testEventCode !== 'string' || !testEventCode.trim())) {
      throw new ApiError(400, 'testEventCode must be a non-empty string');
    }
    const deps = await createAdsDepsForRequest(locals);
    const ads = await makeAcquisitionAds(deps);
    const result = await ads.recordConversion.recordConversion({
      trigger: 'Purchase',
      sessionId: 'test-' + crypto.randomUUID(),
      saleId: 'test-sale',
      funnelId: 'test-funnel',
      eventTimeMs: Date.now(),
      consentLevel: 'GRANTED',
    });
    return { accepted: result.enqueuedPostbacks > 0, reason: result.enqueuedPostbacks === 0 ? 'no_active_mappings' : undefined };
  },
);
