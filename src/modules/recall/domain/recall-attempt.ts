import {
  AttemptStatus,
  type ChannelValue,
  type ContactSnapshot,
  type DeliveryOutcome,
  type EngagementOutcome,
  type StopReason,
} from './value-objects';

export interface Touch {
  readonly touchId: string;
  readonly stepIndex: number;
  readonly channel: ChannelValue;
  readonly scheduledFor: Date;
  firedAt: Date | null;
  messageHandoffRef: string | null;
  deliveryOutcome: DeliveryOutcome;
  engagementOutcome: EngagementOutcome;
}

export interface RecallAttemptEnrollInput {
  checkoutRef: string;
  campaignRef: string;
  campaignVersionRef: number;
  contact: ContactSnapshot;
  incentiveRef?: string;
  frequencyCapMaxTouches: number;
}

export interface RecordTouchFiredInput {
  touchId: string;
  stepIndex: number;
  channel: ChannelValue;
  scheduledFor: Date;
  firedAt: Date;
  messageHandoffRef: string;
}

export class RecallAttempt {
  private constructor(
    public id: string | null,
    public readonly checkoutRef: string,
    public readonly campaignRef: string,
    public readonly campaignVersionRef: number,
    public readonly contact: ContactSnapshot,
    public readonly incentiveRef: string | undefined,
    public readonly frequencyCapMaxTouches: number,
    public status: AttemptStatus,
    public nextStepIndex: number,
    private _touches: Touch[],
  ) {}

  get touches(): readonly Touch[] {
    return this._touches;
  }

  get dedupeKey(): string {
    return `${this.checkoutRef}::${this.campaignRef}`;
  }

  get firedCount(): number {
    return this._touches.filter((t) => t.firedAt !== null).length;
  }

  static enroll(input: RecallAttemptEnrollInput): RecallAttempt {
    return new RecallAttempt(
      null,
      input.checkoutRef,
      input.campaignRef,
      input.campaignVersionRef,
      input.contact,
      input.incentiveRef,
      input.frequencyCapMaxTouches,
      AttemptStatus.of('active'),
      0,
      [],
    );
  }

  recordTouchFired(input: RecordTouchFiredInput): void {
    if (this.status.isTerminal()) {
      throw new Error('cannot fire a Touch on an attempt in a terminal state');
    }
    if (this._touches.some((t) => t.touchId === input.touchId)) return;
    this._touches.push({
      touchId: input.touchId,
      stepIndex: input.stepIndex,
      channel: input.channel,
      scheduledFor: input.scheduledFor,
      firedAt: input.firedAt,
      messageHandoffRef: input.messageHandoffRef,
      deliveryOutcome: 'pending',
      engagementOutcome: 'none',
    });
    if (input.stepIndex + 1 > this.nextStepIndex) {
      this.nextStepIndex = input.stepIndex + 1;
    }
  }

  applyOutcome(touchId: string, delivery?: DeliveryOutcome, engagement?: EngagementOutcome): void {
    const t = this._touches.find((x) => x.touchId === touchId);
    if (!t) return;
    if (delivery) t.deliveryOutcome = delivery;
    if (engagement) t.engagementOutcome = engagement;
  }

  suppress(_reason: StopReason): void {
    if (this.status.isTerminal()) return;
    this.status = AttemptStatus.of('suppressed');
  }

  cancel(): void {
    if (this.status.isTerminal()) return;
    this.status = AttemptStatus.of('cancelled');
  }

  goCold(): void {
    if (this.status.isTerminal()) return;
    this.status = AttemptStatus.of('cold');
  }

  markRecovered(): void {
    if (this.status.isTerminal() && this.status.value !== 'active') {
      if (this.status.value === 'recovered') return;
    }
    this.status = AttemptStatus.of('recovered');
  }
}
