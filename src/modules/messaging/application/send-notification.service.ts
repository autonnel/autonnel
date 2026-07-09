import { Dispatch } from '../domain/dispatch';
import { SuppressionPolicy } from '../domain/services/suppression-policy';
import { Address, TemplateKey } from '../domain/value-objects';
import { makeEnvelope } from '@/modules/shared-kernel';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { createLogger } from '@/lib/logger';
import { MessagingEvent } from '../domain/events';
import type { SendNotificationCommand, SendNotificationPort, SendNotificationResult } from './ports/inbound';
import type { DispatchRepositoryPort, SuppressionRepositoryPort, ClockPort, JobEnqueuePort, EventPublisherPort } from './ports/outbound';

const logger = createLogger('Messaging:SendNotification');

export class SendNotificationService implements SendNotificationPort {
  private readonly suppressionPolicy = new SuppressionPolicy();

  constructor(
    private readonly dispatches: DispatchRepositoryPort,
    private readonly suppressions: SuppressionRepositoryPort,
    private readonly jobs: JobEnqueuePort,
    private readonly events: EventPublisherPort,
    private readonly clock: ClockPort,
  ) {}

  async send(command: SendNotificationCommand): Promise<SendNotificationResult> {
    const tenantId = getCurrentTenantId();

    const existing = await this.dispatches.findByIdempotencyKey(command.idempotencyKey);
    if (existing) {
      return { dispatchId: existing.id!, status: existing.status, deduped: true };
    }

    const address = Address.of(command.channel, command.recipient);
    const entries = await this.suppressions.findForAddress(address);
    const correlation = { sourceContext: command.sourceContext, sourceEventId: command.sourceEventId, traceId: command.traceId };

    if (this.suppressionPolicy.isSuppressed(address, entries)) {
      const suppressed = Dispatch.queue({
        tenantId, idempotencyKey: command.idempotencyKey, channel: command.channel, recipient: address,
        templateKey: TemplateKey.of(command.templateKey), templateVersionId: 'pending', senderIdentityId: 'pending', correlation,
      });
      suppressed.suppress();
      const saved = await this.dispatches.save(suppressed);
      await this.events.publish(makeEnvelope(MessagingEvent.NotificationSuppressed, tenantId, {
        dispatchId: saved.id, templateKey: command.templateKey, address: address.normalized,
      }, { causationId: command.sourceEventId }));
      logger.info('send suppressed before enqueue', { dispatchId: saved.id, templateKey: command.templateKey });
      return { dispatchId: saved.id!, status: 'SUPPRESSED', deduped: false };
    }

    const dispatch = Dispatch.queue({
      tenantId, idempotencyKey: command.idempotencyKey, channel: command.channel, recipient: address,
      templateKey: TemplateKey.of(command.templateKey), templateVersionId: 'pending', senderIdentityId: 'pending', correlation,
    });
    // carry render inputs needed by the job on the snapshot via correlation-free side fields
    (dispatch as any).renderInputs = { locale: command.locale ?? 'en', variables: command.variables, unsubscribeUrl: command.unsubscribeUrl };
    const saved = await this.dispatches.save(dispatch);

    await this.events.publish(makeEnvelope(MessagingEvent.NotificationQueued, tenantId, {
      dispatchId: saved.id, templateKey: command.templateKey, channel: command.channel,
    }, { causationId: command.sourceEventId }));

    await this.jobs.enqueue({
      kind: 'messaging.send',
      payload: { dispatchId: saved.id, locale: command.locale ?? 'en', variables: command.variables, unsubscribeUrl: command.unsubscribeUrl },
      idempotencyKey: `messaging.send:${saved.id}`,
      dispatch: 'INLINE_WAIT_UNTIL',
    });

    return { dispatchId: saved.id!, status: 'QUEUED', deduped: false };
  }
}
