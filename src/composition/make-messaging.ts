import { getBasePrisma } from '@/lib/db';
import { decryptCredentials } from '@/lib/services/credentials-crypto';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { PrismaDispatchRepository } from '@/modules/messaging/infra/prisma/dispatch.repository';
import { PrismaTemplateRepository } from '@/modules/messaging/infra/prisma/template.repository';
import { PrismaSuppressionRepository } from '@/modules/messaging/infra/prisma/suppression.repository';
import { TenantConfigAdapter } from '@/modules/messaging/infra/tenant-config.adapter';
import { createDeliveryProvider } from '@/modules/messaging/infra/providers';
import { SendNotificationService } from '@/modules/messaging/application/send-notification.service';
import { ProcessSendJobService } from '@/modules/messaging/application/process-send-job.service';
import { ProcessDeliveryReceiptService } from '@/modules/messaging/application/process-delivery-receipt.service';
import { RetrySweepService } from '@/modules/messaging/application/retry-sweep.service';
import { ManageTemplateService } from '@/modules/messaging/application/manage-template.service';
import { ManageSuppressionService } from '@/modules/messaging/application/manage-suppression.service';
import { RetrySchedule } from '@/modules/messaging/domain/retry-schedule';
import type { MessageDeliveryProviderPort, JobEnqueuePort, EventPublisherPort } from '@/modules/messaging/application/ports/outbound';
import type { SendNotificationPort } from '@/modules/messaging/application/ports/inbound';
import { OutboxEventPublisher } from '@/modules/platform/infra/outbox-event-publisher';
import { makePlatform, registerJobHandler } from './make-platform';
import { getPrincipal, getTenantId, requireFeature } from '@/modules/identity/application/principal-resolution';
import type { PrincipalResolutionPort } from '@/modules/identity/application/ports/inbound';
import { getConfig } from '@/lib/config/get-config';

const clock = { now: () => new Date() };
const retrySchedule = RetrySchedule.of({ baseDelaySeconds: 300, maxAttempts: 5, maxDelaySeconds: 6 * 3600 });

const principals: PrincipalResolutionPort = { getPrincipal, getTenantId, requireFeature };

// Cast at the injection seam: the OutboxEventPublisher adapter fills tenantId/eventId/occurredAt.
function makeEvents(): EventPublisherPort {
  return new OutboxEventPublisher(getBasePrisma()) as never;
}

function makeJobQueue(): JobEnqueuePort {
  return makePlatform().enqueueJob;
}

async function buildProviders(): Promise<Map<string, MessageDeliveryProviderPort>> {
  const cfg = ((await getConfig('email.config')) as any) ?? {};
  // Provider secrets (apiKey / serverToken / accessKey) are stored encrypted.
  const creds = cfg.credentials
    ? ((decryptCredentials(cfg.credentials) as Record<string, unknown>) ?? {})
    : {};
  const map = new Map<string, MessageDeliveryProviderPort>();
  const wire = (slug?: string) => {
    if (!slug || map.has(slug)) return;
    map.set(slug, createDeliveryProvider(slug, { ...cfg, ...(cfg[slug] ?? {}), ...creds }));
  };
  wire(cfg.provider ?? 'resend');
  wire(cfg.fallbackProvider);
  return map;
}

// One-off send (notifications fan-out / test button) that bypasses the template/Dispatch pipeline.
export async function sendAdHocEmail(input: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const cfg = ((await getConfig('email.config')) as any);
  if (!cfg) throw new Error('No email configuration');
  if (cfg.isActive === false) throw new Error('Email configuration is inactive');
  const creds = cfg.credentials ? ((decryptCredentials(cfg.credentials) as Record<string, unknown>) ?? {}) : {};
  const slug = String(cfg.provider ?? 'resend').toLowerCase();
  const provider = createDeliveryProvider(slug, { ...cfg, ...(cfg[slug] ?? {}), ...creds });
  if (!cfg.fromEmail) throw new Error('Email configuration missing fromEmail');
  await provider.send({
    from: cfg.fromEmail,
    fromName: cfg.fromName ?? undefined,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    headers: {},
  });
}

export function makeMessaging() {
  const dispatchRepo = new PrismaDispatchRepository(getTenantPrisma());
  const templateRepo = new PrismaTemplateRepository(getTenantPrisma());
  const suppressionRepo = new PrismaSuppressionRepository(getTenantPrisma());
  const config = new TenantConfigAdapter();
  const jobQueue = makeJobQueue();
  const events = makeEvents();

  const sendNotification = new SendNotificationService(dispatchRepo, suppressionRepo, jobQueue, events, clock);
  const retrySweep = new RetrySweepService(dispatchRepo, jobQueue, retrySchedule, clock);
  const manageTemplate = new ManageTemplateService(templateRepo, principals, events);
  const manageSuppression = new ManageSuppressionService(suppressionRepo, principals);

  const makeProcessSendJob = async () =>
    new ProcessSendJobService(dispatchRepo, templateRepo, suppressionRepo, config, await buildProviders(), events, clock);
  const makeProcessDeliveryReceipt = async () =>
    new ProcessDeliveryReceiptService(dispatchRepo, suppressionRepo, await buildProviders(), events);

  return {
    sendNotification,
    retrySweep,
    manageTemplate,
    manageSuppression,
    makeProcessSendJob,
    makeProcessDeliveryReceipt,
    get processSendJob() { return new ProcessSendJobService(dispatchRepo, templateRepo, suppressionRepo, config, new Map(), events, clock); },
    get processDeliveryReceipt() { return new ProcessDeliveryReceiptService(dispatchRepo, suppressionRepo, new Map(), events); },
  };
}

export function makeSendNotificationPort(): SendNotificationPort {
  return makeMessaging().sendNotification;
}

export async function handleMessagingSendJob(payload: { dispatchId: string; locale?: string; variables?: Record<string, unknown>; unsubscribeUrl?: string }) {
  const svc = await makeMessaging().makeProcessSendJob();
  return svc.processSend(payload.dispatchId, { locale: payload.locale ?? 'en', variables: payload.variables ?? {}, unsubscribeUrl: payload.unsubscribeUrl });
}

export async function runMessagingRetrySweep(batchSize = 50) {
  return makeMessaging().retrySweep.sweep(batchSize);
}

registerJobHandler('messaging.send', (payload) =>
  handleMessagingSendJob(payload as { dispatchId: string; locale?: string; variables?: Record<string, unknown>; unsubscribeUrl?: string }),
);
