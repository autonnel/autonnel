// CRON worker: synchronously re-check authoritative paid/voided BEFORE handing a Touch to Messaging.
import { RecallScheduler } from '../domain/services/recall-scheduler';
import { SuppressionResolver } from '../domain/services/suppression-resolver';
import { SuppressionEntry } from '../domain/suppression';
import type { ClockPort } from '../domain/ports';
import type { RecallAttempt } from '../domain/recall-attempt';
import type {
  RecallCampaignRepository,
  RecallAttemptRepository,
  SuppressionRepository,
  CheckoutPaymentStatusPort,
  MessagingPort,
  CheckoutResumePort,
  CommerceGatewayReadPort,
  EventPublisherPort,
  AppConfigPort,
} from './ports';

export class ProcessDueTouchService {
  private readonly suppressionResolver = new SuppressionResolver();

  constructor(
    private readonly campaigns: RecallCampaignRepository,
    private readonly attempts: RecallAttemptRepository,
    private readonly suppressions: SuppressionRepository,
    private readonly paymentStatus: CheckoutPaymentStatusPort,
    private readonly messaging: MessagingPort,
    private readonly resume: CheckoutResumePort,
    private readonly commerce: CommerceGatewayReadPort,
    private readonly events: EventPublisherPort,
    private readonly appConfig: AppConfigPort,
    private readonly clock: ClockPort,
  ) {}

  async processDueBatch(limit: number): Promise<{ processed: number }> {
    const now = this.clock.now();
    const config = await this.appConfig.getRecallConfig();
    if (!config.enabled) return { processed: 0 };

    const campaign = await this.campaigns.findActive();
    if (!campaign) return { processed: 0 };

    const scheduler = new RecallScheduler(this.clock);
    const batch = await this.attempts.claimDueBatch(now, limit);
    let processed = 0;

    for (const attempt of batch) {
      processed += 1;
      // Authoritative paid/voided re-check at fire time (independent of outbox ordering).
      const status = await this.paymentStatus.getStatus(attempt.checkoutRef);
      if (status.paid || status.voided) {
        attempt.suppress('paid');
        await this.attempts.save(attempt);
        await this.suppressions.upsert(
          SuppressionEntry.create({
            scope: 'checkout',
            subjectKey: attempt.checkoutRef,
            reason: status.paid ? 'paid' : 'manual',
            source: 'payment_captured',
            expiresAt: null,
          }, now),
        );
        continue;
      }

      const active = await this.suppressions.findActiveBySubject([attempt.contact.hashedIdentity, attempt.checkoutRef], now);
      if (this.suppressionResolver.isBlocked({ hashedIdentity: attempt.contact.hashedIdentity, checkoutRef: attempt.checkoutRef }, active, now)) {
        attempt.suppress('optout');
        await this.attempts.save(attempt);
        continue;
      }

      const enrolledAt = (attempt as unknown as { enrolledAt: Date }).enrolledAt;
      const due = scheduler.nextDueTouch({
        enrolledAt,
        nextStepIndex: attempt.nextStepIndex,
        campaign: { recallWindowHours: campaign.recallWindowHours, steps: campaign.steps.map((s) => ({ ...s })) },
        quietHours: config.quietHours,
        firedCount: attempt.firedCount,
        frequencyCapMaxTouches: attempt.frequencyCapMaxTouches,
      });

      if (due.decision === 'cold') {
        attempt.goCold();
        await this.attempts.save(attempt);
        await this.events.publish({ type: 'RecallAttemptCold', payload: { checkoutRef: attempt.checkoutRef } });
        continue;
      }
      if (due.decision === 'wait' || due.decision === 'defer') {
        await this.attempts.save(attempt);
        continue;
      }

      await this.fire(attempt, campaign.steps[due.stepIndex!], due.stepIndex!, now);
    }

    return { processed };
  }

  private async fire(
    attempt: RecallAttempt,
    step: { channel: 'email' | 'sms' | 'push' | 'ad_retarget' | 'webhook'; templateKey: string; incentiveRef?: string },
    stepIndex: number,
    now: Date,
  ): Promise<void> {
    const idempotencyKey = `${attempt.id}::step:${stepIndex}`;
    const couponCode = step.incentiveRef
      ? (await this.commerce.resolveIncentive(step.incentiveRef))?.code
      : undefined;
    // `resumeUrl`/`couponCode` match the recall.abandoned_checkout template variable names; the
    // resume link also carries ?coupon= so the storefront auto-applies it. `locale` selects language.
    const resumeUrl = await this.resume.buildResumeLink(
      attempt.checkoutRef,
      couponCode ? { coupon: couponCode } : {},
    );
    const { messageHandoffRef } = await this.messaging.sendTouch({
      channel: step.channel,
      recipientAddress: attempt.contact.normalizedEmail ?? attempt.contact.normalizedPhone ?? '',
      templateKey: step.templateKey,
      mergeVariables: { resumeUrl, couponCode: couponCode ?? '', locale: attempt.contact.locale },
      idempotencyKey,
    });

    attempt.recordTouchFired({
      touchId: idempotencyKey,
      stepIndex,
      channel: step.channel,
      scheduledFor: now,
      firedAt: now,
      messageHandoffRef,
    });
    await this.attempts.save(attempt);
    await this.events.publish({
      type: 'RecallTouchFired',
      payload: { checkoutRef: attempt.checkoutRef, stepIndex, channel: step.channel, touchId: idempotencyKey },
    });
  }
}
