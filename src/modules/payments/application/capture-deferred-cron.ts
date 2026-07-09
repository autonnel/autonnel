import type { PaymentIntentRepositoryPort } from './ports/outbound';
import type { ConfirmPayPalOrderService } from './confirm-paypal-order.service';
import { createLogger } from '../../../lib/logger';

const logger = createLogger('CaptureDeferredCron');

// Safety net for PayPal merged upsells: a buyer who abandons mid-upsell leaves the order APPROVED
// but uncaptured. Capture anything untouched past the cutoff (base + upsells accepted so far) so the
// main sale is never lost. `updatedAt < cutoff` naturally excludes buyers still actively upselling,
// since each accepted upsell patch refreshes the intent.
export async function runDeferredCaptureSweep(deps: {
  intentRepo: PaymentIntentRepositoryPort;
  confirm: ConfirmPayPalOrderService;
  cutoff: Date;
  limit: number;
}): Promise<{ captured: number; failed: number; scanned: number }> {
  const stale = await deps.intentRepo.findDeferredOlderThan(deps.cutoff, deps.limit);
  let captured = 0;
  let failed = 0;
  for (const intent of stale) {
    try {
      const r = await deps.confirm.captureNow({ saleRef: intent.saleRef.value, idempotencyKey: `safetynet:${intent.id}` });
      if (r.status === 'succeeded') captured++;
      else failed++;
    } catch (err) {
      failed++;
      logger.error('abandoned deferred capture failed', { error: err, saleRef: intent.saleRef.value });
    }
  }
  if (stale.length) logger.info('orders.auto-capture sweep finished', { captured, failed, scanned: stale.length });
  return { captured, failed, scanned: stale.length };
}
