import { getBasePrisma } from '@/lib/db';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { funnelNextStepIsUpsell } from '@/lib/funnel-next-step';
import { createLogger } from '@/lib/logger';

const logger = createLogger('DeferHandoff');

// Hold the single ecommerce push when an upsell follows checkout so base + upsells push as ONE
// merged order (Stripe still charges separately per upsell). Set before the drain delivers the
// capture event. Non-upsell checkouts are untouched (push at checkout as before).
export async function maybeDeferHandoff(saleRef: string, funnelId?: string, pageId?: string): Promise<void> {
  if (!pageId) return;
  try {
    if (await funnelNextStepIsUpsell(pageId, funnelId ?? null)) {
      await getBasePrisma().paymentIntent.update({
        where: { tenantId_saleRef: { tenantId: getCurrentTenantId(), saleRef } },
        data: { handoffDeferred: true },
      });
    }
  } catch (err) {
    logger.warn('Failed to set handoffDeferred; ecommerce push will proceed at checkout', { error: err, saleRef });
  }
}
