import type { InternalTrigger } from '../mapping/event-mapping-profile';

export class DeduplicationKeyDeriver {
  derive(input: { trigger: InternalTrigger; sessionId: string; saleId?: string }): string {
    return `${input.trigger}:${input.sessionId}:${input.saleId ?? '0'}`;
  }
}
