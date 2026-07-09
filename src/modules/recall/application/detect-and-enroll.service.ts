import { AbandonmentDetector } from '../domain/services/abandonment-detector';
import { EligibilityEvaluator } from '../domain/services/eligibility-evaluator';
import { RecallAttempt } from '../domain/recall-attempt';
import type { ClockPort } from '../domain/ports';
import type {
  RecallCampaignRepository,
  RecallAttemptRepository,
  SuppressionRepository,
  JobQueuePort,
  EventPublisherPort,
  FunnelSessionAbandonedEvent,
} from './ports';

const RECALL_DUE_TOUCH_KIND = 'recall.due_touch';

export class DetectAndEnrollService {
  private readonly detector = new AbandonmentDetector();
  private readonly evaluator = new EligibilityEvaluator();

  constructor(
    private readonly campaigns: RecallCampaignRepository,
    private readonly attempts: RecallAttemptRepository,
    private readonly suppressions: SuppressionRepository,
    private readonly jobQueue: JobQueuePort,
    private readonly events: EventPublisherPort,
    private readonly clock: ClockPort,
  ) {}

  async handle(evt: FunnelSessionAbandonedEvent): Promise<void> {
    const campaign = await this.campaigns.findActive();
    if (!campaign) return;
    if (!evt.contact?.hashedIdentity) return;

    if (!this.detector.isEnrollable(
      { checkoutRef: evt.checkoutRef, contact: { ...evt.contact, locale: evt.locale }, cartValueMinor: evt.cartValueMinor },
      campaign.eligibility,
    )) return;

    const existing = await this.attempts.findByDedupeKey(evt.checkoutRef, campaign.id ?? campaign.name);
    if (existing) return;

    const now = this.clock.now();
    const active = await this.suppressions.findActiveBySubject([evt.contact.hashedIdentity, evt.checkoutRef], now);
    const verdict = this.evaluator.evaluate({
      contact: { ...evt.contact, locale: evt.locale },
      checkoutRef: evt.checkoutRef,
      activeSuppressions: active,
      now,
    });
    if (!verdict.enroll) return;

    const attempt = RecallAttempt.enroll({
      checkoutRef: evt.checkoutRef,
      campaignRef: campaign.id ?? campaign.name,
      campaignVersionRef: campaign.campaignVersion,
      contact: { ...evt.contact, locale: evt.locale },
      incentiveRef: campaign.steps[0]?.incentiveRef,
      frequencyCapMaxTouches: campaign.frequencyCap.maxTouches,
    });
    const saved = await this.attempts.save(attempt);

    await this.jobQueue.enqueue({
      kind: RECALL_DUE_TOUCH_KIND,
      idempotencyKey: `${saved.dedupeKey}::enroll`,
      payload: { attemptId: saved.id, checkoutRef: evt.checkoutRef },
    });

    await this.events.publish({
      type: 'RecallEnrolled',
      payload: { checkoutRef: evt.checkoutRef, campaignVersion: campaign.campaignVersion, sessionId: evt.sessionId },
    });
  }
}
