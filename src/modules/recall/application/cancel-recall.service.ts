import type { RecallAttemptRepository, EventPublisherPort } from './ports';

export class CancelRecallService {
  constructor(
    private readonly attempts: RecallAttemptRepository,
    private readonly events: EventPublisherPort,
  ) {}

  async cancelByCheckoutRef(checkoutRef: string): Promise<void> {
    const attempts = await this.attempts.findByCheckoutRef(checkoutRef);
    for (const attempt of attempts) {
      if (attempt.status.isTerminal() && attempt.status.value !== 'active') continue;
      attempt.cancel();
      await this.attempts.save(attempt);
      await this.events.publish({ type: 'RecallAttemptCancelled', payload: { checkoutRef } });
    }
  }
}
