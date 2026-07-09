import { SuppressionResolver } from '../domain/services/suppression-resolver';
import { SuppressionEntry } from '../domain/suppression';
import type { ClockPort } from '../domain/ports';
import type {
  SuppressionRepository,
  EventPublisherPort,
  EngagementCallbackEvent,
  RecipientSuppressedEvent,
} from './ports';

export class HandleEngagementCallbackService {
  private readonly resolver = new SuppressionResolver();

  constructor(
    private readonly suppressions: SuppressionRepository,
    private readonly events: EventPublisherPort,
    private readonly clock: ClockPort,
  ) {}

  async onRecipientSuppressed(evt: RecipientSuppressedEvent): Promise<void> {
    const entry = this.resolver.fromMessagingEvent(evt);
    await this.suppressions.upsert(entry);
    await this.events.publish({
      type: 'ContactSuppressed',
      payload: { scope: entry.scope, subjectKey: entry.subjectKey, reason: entry.reason },
    });
  }

  async onEngagement(evt: EngagementCallbackEvent & { hashedIdentity?: string }): Promise<void> {
    if (evt.engagement === 'unsubscribed' && evt.hashedIdentity) {
      const entry = SuppressionEntry.create(
        { scope: 'contact', subjectKey: evt.hashedIdentity, reason: 'optout', source: 'engagement_callback', expiresAt: null },
        this.clock.now(),
      );
      await this.suppressions.upsert(entry);
      await this.events.publish({ type: 'ContactSuppressed', payload: { scope: 'contact', subjectKey: evt.hashedIdentity, reason: 'optout' } });
    }
    // bounce-driven suppression arrives separately via onRecipientSuppressed
  }
}
