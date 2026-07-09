import type { DomainEventEnvelope } from '@/modules/shared-kernel/event-envelope';
import type { NotificationPairing } from '@/lib/services/notification-routing-types';
import { dispatchSlack, dispatchWebhook, type DispatchResult } from '@/lib/services/notification-dispatcher';
import { makeSendNotificationPort } from '@/composition/make-messaging';
import { getNotificationsRoutes, getBrandingName } from '@/lib/config/keys';
import { EVENT_CATALOG_BY_ID } from '@/lib/notifications/events-catalog';
import { catalogEventIdsForEnvelope } from '@/lib/notifications/event-source-map';
import { MQEventType } from '@/lib/adapters/mq/types';
import { ChannelType } from '@/modules/messaging/domain/value-objects';
import { GENERIC_NOTIFICATION_KEY } from '@/modules/messaging/infra/templates/default-version.factory';
import { PrismaDispatchRepository } from '@/modules/messaging/infra/prisma/dispatch.repository';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { createLogger } from '@/lib/logger';

const logger = createLogger('EventNotifications');

const SOURCE_CONTEXT = 'notifications';

export function selectMatchingPairings(routes: NotificationPairing[], event: string | string[]): NotificationPairing[] {
  const ids = new Set(Array.isArray(event) ? event : [event]);
  return routes.filter((p) => p.enabled && Array.isArray(p.events) && p.events.some((e) => ids.has(e)));
}

export function renderEventNotification(
  envelope: DomainEventEnvelope,
  brandName: string,
  catalogId: string = envelope.type,
): { subject: string; body: string } {
  const label = EVENT_CATALOG_BY_ID.get(catalogId)?.label ?? catalogId;
  const subject = `[${brandName}] ${label}`;
  const payload = (envelope.payload ?? {}) as Record<string, unknown>;

  if (catalogId === MQEventType.ANALYSIS_CONVERSION_COMPLETED && typeof payload.summary === 'string') {
    const analysis = typeof payload.analysis === 'string' && payload.analysis.length > 0 ? `\n\nAnalysis:\n${payload.analysis}` : '';
    const body = `Time range: ${String(payload.timeRange ?? '')}\nSessions analyzed: ${String(payload.sessionsAnalyzed ?? 0)}\n\n${payload.summary}${analysis}`;
    return { subject, body };
  }

  return { subject, body: `${label}\n\n${JSON.stringify(envelope.payload).slice(0, 2000)}` };
}

export interface QueueEmailInput {
  recipients: string[];
  subject: string;
  body: string;
  purpose: string;
  eventId: string;
  pairingId: string;
}

export interface RecordChannelDispatchInput {
  channel: 'SLACK' | 'WEBHOOK';
  recipient: string;
  subject: string;
  purpose: string;
  eventId: string;
  pairingId: string;
  result: DispatchResult;
}

export interface EventNotificationDeps {
  loadRoutes(): Promise<NotificationPairing[] | null | undefined>;
  loadBrandName(): Promise<string | null | undefined>;
  queueEmail(input: QueueEmailInput): Promise<void>;
  deliverSlack(args: { tenantId: string; purpose: string; subject: string; body: string; webhookUrl: string }): Promise<DispatchResult>;
  deliverWebhook(args: { tenantId: string; purpose: string; subject: string; body: string; url: string; secret?: string }): Promise<DispatchResult>;
  recordChannelDispatch(input: RecordChannelDispatchInput): Promise<void>;
}

// Production wiring: email rides the same SendNotificationService -> Dispatch + messaging.send
// pipeline as order lifecycle emails (template render + retry sweep); Slack/webhook deliver
// synchronously then write their own terminal Dispatch row.
function productionDeps(): EventNotificationDeps {
  return {
    loadRoutes: getNotificationsRoutes,
    loadBrandName: getBrandingName,
    async queueEmail(input) {
      const port = makeSendNotificationPort();
      for (const recipient of input.recipients) {
        await port.send({
          channel: ChannelType.EMAIL,
          recipient,
          templateKey: GENERIC_NOTIFICATION_KEY,
          variables: { subject: input.subject, body: input.body },
          idempotencyKey: `notify:${input.eventId}:${input.pairingId}:${recipient}`,
          sourceContext: SOURCE_CONTEXT,
          sourceEventId: input.purpose,
        });
      }
    },
    deliverSlack: dispatchSlack,
    deliverWebhook: dispatchWebhook,
    async recordChannelDispatch(input) {
      const repo = new PrismaDispatchRepository(getTenantPrisma());
      await repo.recordTerminal({
        idempotencyKey: `notify:${input.eventId}:${input.pairingId}:${input.channel}`,
        channel: input.channel,
        recipient: input.recipient,
        templateKey: GENERIC_NOTIFICATION_KEY,
        sourceContext: SOURCE_CONTEXT,
        sourceEventId: input.purpose,
        subject: input.subject,
        status: input.result.status === 'sent' ? 'SENT' : 'FAILED',
        error: input.result.error,
      });
    },
  };
}

export async function deliverEventNotifications(
  envelope: DomainEventEnvelope,
  deps: EventNotificationDeps = productionDeps(),
): Promise<void> {
  const eventIds = catalogEventIdsForEnvelope(envelope.type);
  if (eventIds.length === 0) return;

  const routes = (await deps.loadRoutes()) ?? [];
  const matching = selectMatchingPairings(routes, eventIds);
  if (matching.length === 0) return;

  const catalogId = eventIds[0];
  const brand = (await deps.loadBrandName()) ?? 'Autonnel';
  const { subject, body } = renderEventNotification(envelope, brand, catalogId);
  const purpose = catalogId;
  const eventId = envelope.eventId;
  const tenantId = envelope.tenantId;

  for (const pairing of matching) {
    try {
      const ch = pairing.channel;
      if (ch.type === 'email') {
        await deps.queueEmail({ recipients: ch.recipients, subject, body, purpose, eventId, pairingId: pairing.id });
      } else if (ch.type === 'slack') {
        const result = await deps.deliverSlack({ tenantId, purpose, subject, body, webhookUrl: ch.webhookUrl });
        await deps.recordChannelDispatch({ channel: 'SLACK', recipient: ch.webhookUrl, subject, purpose, eventId, pairingId: pairing.id, result });
      } else if (ch.type === 'webhook') {
        const result = await deps.deliverWebhook({ tenantId, purpose, subject, body, url: ch.url, secret: ch.secret });
        await deps.recordChannelDispatch({ channel: 'WEBHOOK', recipient: ch.url, subject, purpose, eventId, pairingId: pairing.id, result });
      }
    } catch (error) {
      logger.error('notification pairing dispatch failed', { pairingId: pairing.id, type: envelope.type, error });
    }
  }
}
