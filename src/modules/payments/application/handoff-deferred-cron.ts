import type { PaymentIntentRepositoryPort } from './ports/outbound';
import { createLogger } from '../../../lib/logger';

const logger = createLogger('HandoffDeferredCron');

// Safety net for Stripe merged upsells: a buyer who abandons mid-upsell leaves the base CAPTURED but
// the single ecommerce push still HELD (handoffDeferred). Fire the merged push past the cutoff so the
// order reaches the commerce backend. `updatedAt < cutoff` excludes buyers still actively upselling
// (each accepted upsell refreshes the intent).
export async function runDeferredHandoffSweep(deps: {
  intentRepo: PaymentIntentRepositoryPort;
  enqueueHandoff: (saleRef: string) => Promise<void>;
  clearFlag: (saleRef: string) => Promise<void>;
  cutoff: Date;
  limit: number;
}): Promise<{ pushed: number; failed: number; scanned: number }> {
  const stale = await deps.intentRepo.findHandoffDeferredOlderThan(deps.cutoff, deps.limit);
  let pushed = 0;
  let failed = 0;
  for (const intent of stale) {
    try {
      await deps.enqueueHandoff(intent.saleRef.value);
      await deps.clearFlag(intent.saleRef.value);
      pushed++;
    } catch (err) {
      failed++;
      logger.error('abandoned merged handoff enqueue failed', { error: err, saleRef: intent.saleRef.value });
    }
  }
  if (stale.length) logger.info('ecommerce merged-push sweep finished', { pushed, failed, scanned: stale.length });
  return { pushed, failed, scanned: stale.length };
}
