import type { ReconcilePendingIntentsService } from './reconcile-pending-intents.service';
import { createLogger } from '../../../lib/logger';

const logger = createLogger('PaymentReconcileCron');

export async function runPaymentReconcileSweep(
  make: () => ReconcilePendingIntentsService,
): Promise<{ reconciled: number }> {
  const out = await make().run();
  logger.info('payment.reconcile sweep finished', { reconciled: out.reconciled });
  return out;
}
