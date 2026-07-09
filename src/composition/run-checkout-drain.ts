import { getBasePrisma } from '@/lib/db';
import { makePlatform } from '@/composition/make-platform';
import { OutboxDrainService } from '@/modules/platform/infra/outbox-event-publisher';
import { registerAllJobHandlers } from '@/composition/register-job-handlers';
import { makeEventDelivery } from '@/composition/make-event-delivery';
import { createLogger } from '@/lib/logger';

const logger = createLogger('CheckoutDrain');

const MAX_CYCLES = 6;

// A shopper completing payment lands on the SSR-only thank-you page, which can only render an Order
// row that already exists. The Order is created by the payment.captured outbox delivery, so we drain
// the outbox and return as soon as the Order materializes — WITHOUT waiting on pollPendingJobs, whose
// commerce.handoff jobs can hit a slow/unreachable backend and would otherwise stall the response.
export async function runCheckoutDrain(tenantId: string, saleRef: string, locals: unknown): Promise<void> {
  const orderExists = async () =>
    !!(await getBasePrisma().order.findFirst({ where: { tenantId, saleRef }, select: { id: true } }));
  try {
    registerAllJobHandlers();
    const platform = makePlatform(locals as { cfContext?: { waitUntil(p: Promise<unknown>): void } });
    const outbox = new OutboxDrainService(getBasePrisma(), makeEventDelivery(locals));

    for (let i = 0; i < MAX_CYCLES; i++) {
      await outbox.drain();
      if (await orderExists()) return; // created by the outbox delivery — don't block on the job backlog
      await platform.pollPendingJobs.poll();
      if (await orderExists()) return;
    }
    logger.warn('order not materialized after inline drain; cron will catch up', { saleRef });
  } catch (error) {
    logger.error('inline checkout drain failed; cron will catch up', { error });
  }
}
