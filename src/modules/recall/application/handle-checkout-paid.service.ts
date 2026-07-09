// Suppress early on PaymentCaptured. Correctness is still guaranteed by the touch-time re-check in ProcessDueTouchService.
import { RecoveryAttributor } from '../domain/services/recovery-attributor';
import { SuppressionEntry } from '../domain/suppression';
import type { ClockPort } from '../domain/ports';
import type {
  RecallAttemptRepository,
  SuppressionRepository,
  EventPublisherPort,
  AppConfigPort,
  PaymentCapturedEvent,
} from './ports';

export class HandleCheckoutPaidService {
  private readonly attributor = new RecoveryAttributor();

  constructor(
    private readonly attempts: RecallAttemptRepository,
    private readonly suppressions: SuppressionRepository,
    private readonly events: EventPublisherPort,
    private readonly appConfig: AppConfigPort,
    private readonly clock: ClockPort,
  ) {}

  async handle(evt: PaymentCapturedEvent): Promise<void> {
    const now = this.clock.now();
    const config = await this.appConfig.getRecallConfig();

    await this.suppressions.upsert(
      SuppressionEntry.create(
        { scope: 'checkout', subjectKey: evt.checkoutRef, reason: 'paid', source: 'payment_captured', expiresAt: null },
        now,
      ),
    );

    const attempts = await this.attempts.findByCheckoutRef(evt.checkoutRef);
    for (const attempt of attempts) {
      if (attempt.status.isTerminal() && attempt.status.value !== 'active') continue;
      const result = this.attributor.attribute(attempt, new Date(evt.capturedAt), config.attributionWindowHours);
      attempt.markRecovered();
      await this.attempts.save(attempt);
      await this.events.publish({
        type: 'RecallRecovered',
        payload: { checkoutRef: evt.checkoutRef, saleRef: evt.saleRef, attributedTouchId: result.attributedTouchId },
      });
    }
  }
}
