import type { Money } from '../../../shared-kernel/money';

interface ConversionEventProps {
  eventName: string;
  eventId: string;
  eventTimeMs: number;
  value?: Money;
}

export class ConversionEvent {
  readonly eventName: string;
  readonly eventId: string;
  readonly eventTimeMs: number;
  readonly value?: Money;

  private constructor(props: ConversionEventProps) {
    this.eventName = props.eventName;
    this.eventId = props.eventId;
    this.eventTimeMs = props.eventTimeMs;
    this.value = props.value;
    Object.freeze(this);
  }

  static create(props: ConversionEventProps): ConversionEvent {
    return new ConversionEvent(props);
  }
}
