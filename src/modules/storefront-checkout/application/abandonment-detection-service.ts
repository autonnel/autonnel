import { saleEvents } from '../domain/events';
import { FunnelSession } from '../domain/funnel-session';
import type { DomainEventPublisherPort } from './ports/outbound';

export interface AbandonmentDetectionDeps {
  publisher: DomainEventPublisherPort;
  isLinkedSalePaid: (saleId: string) => Promise<boolean>;
}

export class AbandonmentDetectionService {
  constructor(private readonly deps: AbandonmentDetectionDeps) {}

  // Single abandonment authority: emit exactly one enrollment trigger.
  async detect(session: FunnelSession): Promise<boolean> {
    if (session.linkedSaleId && (await this.deps.isLinkedSalePaid(session.linkedSaleId))) {
      return false; // paid → not abandoned
    }
    await this.deps.publisher.publish([
      saleEvents.funnelSessionAbandoned({
        sessionId: session.sessionId,
        hashedIdentity: session.contactHandle?.hashedIdentity ?? null,
      }),
    ]);
    return true;
  }
}
