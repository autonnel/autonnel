import { SuppressionEntry } from '../suppression';

export interface MessagingSuppressionEvent {
  channel: string;
  normalizedAddress: string;
  hashedIdentity: string;
  messagingReason: string;
}

export class SuppressionResolver {
  fromMessagingEvent(e: MessagingSuppressionEvent): SuppressionEntry {
    return SuppressionEntry.fromMessagingSuppression(e);
  }

  isBlocked(
    subject: { hashedIdentity: string; checkoutRef: string },
    suppressions: SuppressionEntry[],
    now: Date,
  ): boolean {
    return suppressions.some(
      (s) =>
        s.isActive(now) &&
        (s.matches('contact', subject.hashedIdentity) || s.matches('checkout', subject.checkoutRef)),
    );
  }
}
