import { BounceClassifier, ReceiptKind } from '../domain/services/bounce-classifier';
import { SuppressionEntry } from '../domain/suppression-entry';
import { Address, ChannelType, DispatchStatus, isTerminalStatus } from '../domain/value-objects';
import { makeEnvelope } from '@/modules/shared-kernel';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { createLogger } from '@/lib/logger';
import { MessagingEvent } from '../domain/events';
import type { DeliveryReceiptWebhookPort } from './ports/inbound';
import type { DispatchRepositoryPort, SuppressionRepositoryPort, MessageDeliveryProviderPort, EventPublisherPort, DeliveryReceiptEvent } from './ports/outbound';

const logger = createLogger('Messaging:DeliveryReceipt');

const EVENT_BY_STATUS: Record<string, string> = {
  [DispatchStatus.DELIVERED]: MessagingEvent.NotificationDelivered,
  [DispatchStatus.BOUNCED]: MessagingEvent.NotificationBounced,
  [DispatchStatus.COMPLAINED]: MessagingEvent.NotificationComplained,
};

export class ProcessDeliveryReceiptService implements DeliveryReceiptWebhookPort {
  private readonly classifier = new BounceClassifier();

  constructor(
    private readonly dispatches: DispatchRepositoryPort,
    private readonly suppressions: SuppressionRepositoryPort,
    private readonly providers: Map<string, MessageDeliveryProviderPort>,
    private readonly events: EventPublisherPort,
  ) {}

  async ingest(providerSlug: string, verifiedPayload: unknown): Promise<{ processed: number }> {
    const tenantId = getCurrentTenantId();
    const provider = this.providers.get(providerSlug);
    if (!provider) throw new Error(`provider not wired: ${providerSlug}`);

    const receipts: DeliveryReceiptEvent[] = Array.isArray(verifiedPayload)
      ? (verifiedPayload as DeliveryReceiptEvent[])
      : await provider.parseWebhook(verifiedPayload);

    let processed = 0;
    for (const r of receipts) {
      const dispatch = await this.dispatches.findByProviderMessageId(r.providerMessageId);
      if (!dispatch) {
        logger.warn('orphan receipt, no matching dispatch', { providerMessageId: r.providerMessageId, kind: r.kind });
        continue;
      }

      const result = this.classifier.classify(r.kind as ReceiptKind);

      if (result.engaged) {
        await this.events.publish(makeEnvelope(MessagingEvent.NotificationEngaged, tenantId, { dispatchId: dispatch.id, kind: r.kind }));
        processed += 1;
        continue;
      }

      if (!result.transition) { processed += 1; continue; } // soft bounce: no terminal transition

      if (isTerminalStatus(dispatch.status)) { processed += 1; continue; } // idempotent re-apply

      this.applyTransition(dispatch, result.transition);
      await this.dispatches.save(dispatch);
      const eventType = EVENT_BY_STATUS[result.transition];
      if (eventType) await this.events.publish(makeEnvelope(eventType, tenantId, { dispatchId: dispatch.id }));

      if (result.suppress) {
        const entry = SuppressionEntry.create({
          tenantId,
          address: Address.of(ChannelType.EMAIL, dispatch.recipient.normalized),
          reason: result.suppress,
          source: `provider:${providerSlug}`,
        });
        await this.suppressions.upsert(entry);
        await this.events.publish(makeEnvelope(MessagingEvent.RecipientSuppressed, tenantId, {
          channel: ChannelType.EMAIL, normalizedAddress: dispatch.recipient.normalized, reason: result.suppress,
        }));
      }
      processed += 1;
    }
    return { processed };
  }

  private applyTransition(dispatch: { markDelivered(): void; markBounced(): void; markComplained(): void }, to: DispatchStatus): void {
    if (to === DispatchStatus.DELIVERED) dispatch.markDelivered();
    else if (to === DispatchStatus.BOUNCED) dispatch.markBounced();
    else if (to === DispatchStatus.COMPLAINED) dispatch.markComplained();
  }
}
