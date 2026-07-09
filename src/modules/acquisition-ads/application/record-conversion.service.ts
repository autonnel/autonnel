import { Postback } from '../domain/postback/postback';
import { EventNormalizationService } from '../domain/services/event-normalization';
import { ConsentGate } from '../domain/services/consent-gate';
import { RetryPolicy } from '../domain/value-objects/retry-policy';
import { HashedIdentity } from '../domain/value-objects/hashed-identity';
import { ConsentState, type ConsentLevel } from '../domain/value-objects/consent-state';
import type { Money } from '../../shared-kernel/money';
import type { InternalTrigger } from '../domain/mapping/event-mapping-profile';
import type {
  EventMappingRepositoryPort,
  PostbackRepositoryPort,
  AttributionStorePort,
} from './ports/outbound';

interface Deps {
  mappingRepo: EventMappingRepositoryPort;
  attributionStore: AttributionStorePort;
  postbackRepo: PostbackRepositoryPort;
  jobQueue: { enqueue(job: { kind: string; idempotencyKey: string; payload: unknown }): Promise<void> };
  events: { publish(event: { type: string; payload: unknown }): Promise<void> };
  newId: () => string;
}

export class RecordConversionService {
  private readonly normalizer = new EventNormalizationService();
  private readonly consentGate = new ConsentGate();

  constructor(private readonly deps: Deps) {}

  async recordConversion(input: {
    trigger: InternalTrigger;
    sessionId: string;
    saleId?: string;
    funnelId: string;
    eventTimeMs: number;
    value?: Money;
    consentLevel: ConsentLevel;
    contactHandle?: { emailSha256?: string; phoneSha256?: string };
  }): Promise<{ enqueuedPostbacks: number }> {
    const profile = await this.deps.mappingRepo.findActive();
    if (!profile) return { enqueuedPostbacks: 0 };

    const conversions = this.normalizer.normalize({
      trigger: input.trigger,
      profile,
      sessionId: input.sessionId,
      saleId: input.saleId,
      eventTimeMs: input.eventTimeMs,
      value: input.value,
    });

    const decision = this.consentGate.decide(ConsentState.fromLevel(input.consentLevel));

    const touch = await this.deps.attributionStore.get(`attr:${input.sessionId}`);
    const hashedIdentity = HashedIdentity.fromContactHandle(input.contactHandle ?? {});
    const clickIdentifiers = touch ? [...touch.clickIdentifiers] : [];

    let enqueued = 0;

    for (const c of conversions) {
      const existing = await this.deps.postbackRepo.findByDedup(c.destinationId, c.event.eventId);
      if (existing) continue;

      const postback = Postback.create({
        id: this.deps.newId(),
        destinationId: c.destinationId,
        event: c.event,
        retryPolicy: RetryPolicy.default(),
        dispatchContext: { clickIdentifiers, hashedIdentity },
      });

      if (decision === 'SUPPRESS') {
        postback.suppress('consent_denied');
        await this.deps.postbackRepo.save(postback);
        await this.deps.events.publish({ type: 'ConversionSuppressed', payload: { postbackId: postback.id } });
        continue;
      }

      await this.deps.postbackRepo.save(postback);
      await this.deps.jobQueue.enqueue({
        kind: 'ads.postback.dispatch',
        idempotencyKey: `${c.event.eventId}:${c.destinationId}`,
        payload: { postbackId: postback.id },
      });
      await this.deps.events.publish({ type: 'ConversionReported', payload: { postbackId: postback.id } });
      enqueued += 1;
    }

    return { enqueuedPostbacks: enqueued };
  }
}
