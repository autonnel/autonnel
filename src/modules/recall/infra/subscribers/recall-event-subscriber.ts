// Outbox subscriber: routes consumed published-language events into Recall services.
// Correctness never depends on event ordering; these are optimization/feed paths.
import type { makeRecall } from '../../../../composition/make-recall';
import type { FunnelSessionAbandonedEvent, PaymentCapturedEvent, RecipientSuppressedEvent, EngagementCallbackEvent } from '../../application/ports';

type Recall = ReturnType<typeof makeRecall>;

export interface InboundEvent {
  type: string;
  payload: Record<string, unknown>;
}

export async function dispatchRecallEvent(recall: Recall, evt: InboundEvent): Promise<void> {
  switch (evt.type) {
    case 'FunnelSessionAbandoned':
      await recall.detectAndEnroll.handle(evt.payload as unknown as FunnelSessionAbandonedEvent);
      return;
    case 'PaymentCaptured':
      await recall.handleCheckoutPaid.handle(evt.payload as unknown as PaymentCapturedEvent);
      return;
    case 'RecipientSuppressed':
      await recall.handleEngagementCallback.onRecipientSuppressed(evt.payload as unknown as RecipientSuppressedEvent);
      return;
    case 'NotificationEngaged':
    case 'NotificationDelivered':
    case 'NotificationBounced':
      await recall.handleEngagementCallback.onEngagement(evt.payload as unknown as EngagementCallbackEvent);
      return;
    default:
      return;
  }
}
