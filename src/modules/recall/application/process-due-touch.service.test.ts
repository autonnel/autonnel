import { describe, it, expect, vi } from 'vitest';
import { ProcessDueTouchService } from './process-due-touch.service';
import { RecallCampaign } from '../domain/recall-campaign';
import { RecallAttempt } from '../domain/recall-attempt';

const campaign = RecallCampaign.create({
  name: 'win-back',
  enabledChannels: ['email'],
  recallWindowHours: 168,
  steps: [{ stepIndex: 0, channel: 'email', delayOffsetMinutes: 60, templateKey: 'recall.abandoned_checkout' }],
  frequencyCap: { maxTouches: 3, perWindowHours: 168 },
  eligibility: { requireContactHandle: true },
  stopConditions: { stopOnOptout: true, stopOnBounce: true },
});
campaign.id = 'camp_1';
(campaign as any).enrolledFloor = undefined;

const makeAttempt = () => {
  const a = RecallAttempt.enroll({
    checkoutRef: 'sess_1',
    campaignRef: 'camp_1',
    campaignVersionRef: 1,
    contact: { hashedIdentity: 'h1', normalizedEmail: 'a@b.co', locale: 'en', consentedChannels: ['email'] },
    frequencyCapMaxTouches: 3,
  });
  a.id = 'att_1';
  (a as any).enrolledAt = new Date('2026-06-04T08:00:00Z');
  return a;
};

const deps = (overrides: any = {}) => ({
  campaignRepo: { findActive: vi.fn().mockResolvedValue(campaign), save: vi.fn() },
  attemptRepo: {
    claimDueBatch: vi.fn().mockResolvedValue([makeAttempt()]),
    save: vi.fn().mockImplementation(async (a) => a),
    findByDedupeKey: vi.fn(),
    findByCheckoutRef: vi.fn(),
  },
  suppressionRepo: { findActiveBySubject: vi.fn().mockResolvedValue([]), upsert: vi.fn(), list: vi.fn(), remove: vi.fn() },
  paymentStatus: { getStatus: vi.fn().mockResolvedValue({ paid: false, voided: false }) },
  messaging: { sendTouch: vi.fn().mockResolvedValue({ messageHandoffRef: 'm1' }) },
  resume: { buildResumeLink: vi.fn().mockResolvedValue('https://x/n/f1/checkout?anid=1') },
  commerce: { resolveIncentive: vi.fn().mockResolvedValue(null) },
  events: { publish: vi.fn() },
  appConfig: { getRecallConfig: vi.fn().mockResolvedValue({ enabled: true, quietHours: null, attributionWindowHours: 48 }) },
  clock: { now: () => new Date('2026-06-04T10:00:00Z') },
  ...overrides,
});

const svcFrom = (d: any) =>
  new ProcessDueTouchService(
    d.campaignRepo, d.attemptRepo, d.suppressionRepo, d.paymentStatus, d.messaging, d.resume, d.commerce, d.events, d.appConfig, d.clock,
  );

describe('ProcessDueTouchService (H3)', () => {
  it('fires a due Touch via Messaging and records it on the attempt', async () => {
    const d = deps();
    const res = await svcFrom(d).processDueBatch(50);
    expect(d.paymentStatus.getStatus).toHaveBeenCalledWith('sess_1');
    expect(d.messaging.sendTouch).toHaveBeenCalledOnce();
    expect(d.attemptRepo.save).toHaveBeenCalled();
    expect(res.processed).toBe(1);
  });

  it('H3: paid wins the race — does NOT send, suppresses the attempt', async () => {
    const d = deps({ paymentStatus: { getStatus: vi.fn().mockResolvedValue({ paid: true, voided: false }) } });
    await svcFrom(d).processDueBatch(50);
    expect(d.messaging.sendTouch).not.toHaveBeenCalled();
    const saved = d.attemptRepo.save.mock.calls[0][0];
    expect(saved.status.value).toBe('suppressed');
  });

  it('voided also suppresses without sending', async () => {
    const d = deps({ paymentStatus: { getStatus: vi.fn().mockResolvedValue({ paid: false, voided: true }) } });
    await svcFrom(d).processDueBatch(50);
    expect(d.messaging.sendTouch).not.toHaveBeenCalled();
  });

  it('re-checks suppression at fire time and skips a now-suppressed contact', async () => {
    const d = deps({
      suppressionRepo: {
        findActiveBySubject: vi.fn().mockResolvedValue([{ isActive: () => true, matches: (s: string, k: string) => s === 'contact' && k === 'h1' }]),
        upsert: vi.fn(), list: vi.fn(), remove: vi.fn(),
      },
    });
    await svcFrom(d).processDueBatch(50);
    expect(d.messaging.sendTouch).not.toHaveBeenCalled();
  });

  it('uses a deterministic idempotency key per (attempt, stepIndex)', async () => {
    const d = deps();
    await svcFrom(d).processDueBatch(50);
    const arg = d.messaging.sendTouch.mock.calls[0][0];
    expect(arg.idempotencyKey).toBe('att_1::step:0');
  });

  it('omits coupon when the step has no incentive', async () => {
    const d = deps();
    await svcFrom(d).processDueBatch(50);
    expect(d.commerce.resolveIncentive).not.toHaveBeenCalled();
    expect(d.resume.buildResumeLink).toHaveBeenCalledWith('sess_1', {});
    expect(d.messaging.sendTouch.mock.calls[0][0].mergeVariables.couponCode).toBe('');
  });

  it('resolves the step incentive into a coupon code, the resume link and the template var', async () => {
    const couponCampaign = RecallCampaign.create({
      name: 'win-back',
      enabledChannels: ['email'],
      recallWindowHours: 168,
      steps: [{ stepIndex: 0, channel: 'email', delayOffsetMinutes: 60, templateKey: 'recall.abandoned_checkout', incentiveRef: 'cpn_1' }],
      frequencyCap: { maxTouches: 3, perWindowHours: 168 },
      eligibility: { requireContactHandle: true },
      stopConditions: { stopOnOptout: true, stopOnBounce: true },
    });
    couponCampaign.id = 'camp_1';
    const d = deps({
      campaignRepo: { findActive: vi.fn().mockResolvedValue(couponCampaign), save: vi.fn() },
      commerce: { resolveIncentive: vi.fn().mockResolvedValue({ code: 'SAVE10' }) },
    });
    await svcFrom(d).processDueBatch(50);
    expect(d.commerce.resolveIncentive).toHaveBeenCalledWith('cpn_1');
    expect(d.resume.buildResumeLink).toHaveBeenCalledWith('sess_1', { coupon: 'SAVE10' });
    expect(d.messaging.sendTouch.mock.calls[0][0].mergeVariables.couponCode).toBe('SAVE10');
  });
});
