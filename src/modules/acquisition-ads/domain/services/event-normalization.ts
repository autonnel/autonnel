import { ConversionEvent } from '../value-objects/conversion-event';
import { DeduplicationKeyDeriver } from './deduplication-key-deriver';
import type { EventMappingProfile, InternalTrigger } from '../mapping/event-mapping-profile';
import type { Money } from '../../../shared-kernel/money';

export interface NormalizedConversion {
  destinationId: string;
  event: ConversionEvent;
}

interface NormalizeInput {
  trigger: InternalTrigger;
  profile: EventMappingProfile;
  sessionId: string;
  saleId?: string;
  eventTimeMs: number;
  value?: Money;
}

export class EventNormalizationService {
  constructor(private readonly deriver = new DeduplicationKeyDeriver()) {}

  normalize(input: NormalizeInput): NormalizedConversion[] {
    const eventId = this.deriver.derive({
      trigger: input.trigger,
      sessionId: input.sessionId,
      saleId: input.saleId,
    });
    return input.profile.rulesForTrigger(input.trigger).map((rule) => ({
      destinationId: rule.destinationId,
      event: ConversionEvent.create({
        eventName: rule.platformEventName,
        eventId,
        eventTimeMs: input.eventTimeMs,
        value: input.value,
      }),
    }));
  }
}
