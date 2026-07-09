import type { APIContext } from 'astro';
import { getTenantPrisma } from '../modules/platform/infra/prisma-tenant-extension';
import { getBasePrisma } from '../lib/db';
import { OutboxEventPublisher } from '../modules/platform/infra/outbox-event-publisher';
import { makePlatform, registerJobHandler } from './make-platform';
import { makeRecall } from './make-recall';
import { runRecallDueTouchSweep } from '../modules/recall/infra/cron/process-due-touches.cron';
import { makeMessaging } from './make-messaging';
import { ChannelType } from '../modules/messaging/domain/value-objects';
import { PrismaCouponRepository } from '../modules/coupons/infra/prisma/coupon.repository';
import { buildRecallResumeUrl, type ResumeLinkPrisma } from '../lib/recall/resume-link';
import { loadStoreIdentity } from '../lib/branding/store-identity';
import { getConfig } from '../lib/config/get-config';
import { getCurrentTenantId } from '../lib/tenant/context';
import { makeEnvelope } from '../modules/shared-kernel';
import type { EventPublisherPort } from '../modules/recall/application/ports';
import type { RecallDeps } from './make-recall';

// Recall services publish bare `{type, payload}` events; the outbox row requires a full envelope.
// Enrich with the current tenant + a fresh eventId/occurredAt before persisting.
class RecallOutboxEventPublisher implements EventPublisherPort {
  private readonly outbox: OutboxEventPublisher;
  constructor(base: ConstructorParameters<typeof OutboxEventPublisher>[0]) {
    this.outbox = new OutboxEventPublisher(base);
  }
  async publish(event: { type: string; payload: Record<string, unknown> }): Promise<void> {
    await this.outbox.publish(makeEnvelope(event.type, getCurrentTenantId(), event.payload));
  }
}

type Locals = APIContext['locals'];

export type { RecallDeps } from './make-recall';

export async function createRecallDepsForRequest(_locals?: Locals): Promise<RecallDeps> {
  const db = getTenantPrisma();
  const base = getBasePrisma();
  const platform = makePlatform();

  return {
    prisma: db as unknown as RecallDeps['prisma'],
    sendNotification: {
      async send(input: {
        channel: string;
        recipientAddress: string;
        templateKey: string;
        mergeVariables: Record<string, unknown>;
        idempotencyKey: string;
      }): Promise<{ dispatchId: string }> {
        // Route through the messaging module's send service (same as order-fulfillment): it creates
        // the Dispatch row, resolves the template, and enqueues a well-formed messaging.send job.
        const locale = typeof input.mergeVariables.locale === 'string' ? input.mergeVariables.locale : undefined;
        // The styled recall designs key the CTA on {{checkoutUrl}} and show the store identity in the
        // header/footer; recall fires with `resumeUrl`, so bridge it and inject branding here.
        const resumeUrl = typeof input.mergeVariables.resumeUrl === 'string' ? input.mergeVariables.resumeUrl : '';
        const variables = {
          ...input.mergeVariables,
          checkoutUrl: input.mergeVariables.checkoutUrl ?? resumeUrl,
          ...(await loadStoreIdentity()),
        };
        const result = await makeMessaging().sendNotification.send({
          channel: input.channel.toUpperCase() as ChannelType,
          recipient: input.recipientAddress,
          templateKey: input.templateKey,
          variables,
          idempotencyKey: input.idempotencyKey,
          sourceContext: 'recall',
          locale,
        });
        return { dispatchId: result.dispatchId };
      },
    },
    checkoutPaymentStatus: {
      // checkoutRef is a funnel session id for abandonment-enrolled attempts, or a saleRef for
      // order-originated manual recalls. Resolve a PaymentIntent by either id and re-check the live
      // status before each touch fires, so a checkout paid/voided after enrollment is never emailed.
      async readPaidStatus(checkoutRef: string): Promise<{ paid: boolean; voided: boolean }> {
        const intent = await (
          db as unknown as {
            paymentIntent: { findFirst(args: unknown): Promise<{ status: string } | null> };
          }
        ).paymentIntent.findFirst({
          where: {
            OR: [
              { saleRef: checkoutRef },
              { checkoutSnapshot: { path: ['sessionId'], equals: checkoutRef } },
            ],
          },
          select: { status: true },
          orderBy: { updatedAt: 'desc' },
        });
        if (!intent) return { paid: false, voided: false };
        return {
          paid: intent.status === 'CAPTURED',
          voided: intent.status === 'CANCELED' || intent.status === 'FAILED',
        };
      },
    },
    checkoutResume: {
      async buildResumeLink(checkoutRef: string, params: Record<string, string>): Promise<string> {
        const url = await buildRecallResumeUrl(db as unknown as ResumeLinkPrisma, checkoutRef, { coupon: params.coupon });
        return url ?? '';
      },
    },
    commerceRead: {
      async resolveIncentiveRef(incentiveRef: string): Promise<{ code: string } | null> {
        const coupon = await new PrismaCouponRepository(db).findById(incentiveRef);
        return coupon ? { code: coupon.code } : null;
      },
    },
    jobQueue: platform.enqueueJob as never,
    events: new RecallOutboxEventPublisher(base),
    configQuery: { getConfig },
  };
}

export async function createRecallDepsForCron(
  _env: Record<string, unknown>,
  _tenantId: string,
): Promise<RecallDeps> {
  return createRecallDepsForRequest();
}

// detect-and-enroll enqueues a `recall.due_touch` job; the queue rejects kinds with no handler.
// Firing is otherwise cron-driven, so the handler runs an idempotent sweep (lease + SKIP LOCKED
// guard double-fire).
export function registerRecallHandlers(): void {
  registerJobHandler('recall.due_touch', async () => {
    const recall = makeRecall(await createRecallDepsForRequest());
    return runRecallDueTouchSweep(recall);
  });
}
