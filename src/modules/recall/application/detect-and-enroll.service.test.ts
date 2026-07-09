import { describe, it, expect, vi } from 'vitest';
import { DetectAndEnrollService } from './detect-and-enroll.service';
import { RecallCampaign } from '../domain/recall-campaign';
import type { FunnelSessionAbandonedEvent } from './ports';

const makeCampaign = () =>
  RecallCampaign.create({
    name: 'win-back',
    enabledChannels: ['email'],
    recallWindowHours: 168,
    steps: [{ stepIndex: 0, channel: 'email', delayOffsetMinutes: 60, templateKey: 'recall.abandoned_checkout' }],
    frequencyCap: { maxTouches: 3, perWindowHours: 168 },
    eligibility: { requireContactHandle: true },
    stopConditions: { stopOnOptout: true, stopOnBounce: true },
  });

const evt: FunnelSessionAbandonedEvent = {
  checkoutRef: 'sess_1',
  sessionId: 'sess_1',
  funnelId: 'f1',
  locale: 'en',
  cartValueMinor: 5000,
  contact: { hashedIdentity: 'h1', normalizedEmail: 'a@b.co', consentedChannels: ['email'] },
  attributionParams: { fbclid: 'x' },
};

const deps = () => {
  const campaign = makeCampaign();
  return {
    campaignRepo: { findActive: vi.fn().mockResolvedValue(campaign), save: vi.fn() },
    attemptRepo: {
      findByDedupeKey: vi.fn().mockResolvedValue(null),
      findByCheckoutRef: vi.fn(),
      save: vi.fn().mockImplementation(async (a) => a),
      claimDueBatch: vi.fn(),
    },
    suppressionRepo: {
      findActiveBySubject: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
      list: vi.fn(),
      remove: vi.fn(),
    },
    jobQueue: { enqueue: vi.fn() },
    events: { publish: vi.fn() },
    clock: { now: () => new Date('2026-06-04T10:00:00Z') },
  };
};

describe('DetectAndEnrollService', () => {
  it('enrolls an eligible abandoned session, saves an attempt, enqueues the first due Touch', async () => {
    const d = deps();
    const svc = new DetectAndEnrollService(d.campaignRepo as any, d.attemptRepo as any, d.suppressionRepo as any, d.jobQueue as any, d.events as any, d.clock);
    await svc.handle(evt);
    expect(d.attemptRepo.save).toHaveBeenCalledOnce();
    expect(d.jobQueue.enqueue).toHaveBeenCalledOnce();
    expect(d.events.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'RecallEnrolled' }));
  });

  it('is idempotent: an existing attempt for the same dedupeKey does not re-enroll', async () => {
    const d = deps();
    d.attemptRepo.findByDedupeKey = vi.fn().mockResolvedValue({ id: 'a1' });
    const svc = new DetectAndEnrollService(d.campaignRepo as any, d.attemptRepo as any, d.suppressionRepo as any, d.jobQueue as any, d.events as any, d.clock);
    await svc.handle(evt);
    expect(d.attemptRepo.save).not.toHaveBeenCalled();
    expect(d.jobQueue.enqueue).not.toHaveBeenCalled();
  });

  it('does not enroll when no contact handle is present (H2)', async () => {
    const d = deps();
    const svc = new DetectAndEnrollService(d.campaignRepo as any, d.attemptRepo as any, d.suppressionRepo as any, d.jobQueue as any, d.events as any, d.clock);
    await svc.handle({ ...evt, contact: undefined });
    expect(d.attemptRepo.save).not.toHaveBeenCalled();
  });

  it('does not enroll when an active suppression matches the contact', async () => {
    const d = deps();
    d.suppressionRepo.findActiveBySubject = vi
      .fn()
      .mockResolvedValue([
        { isActive: () => true, matches: (scope: string, key: string) => scope === 'contact' && key === 'h1' },
      ]);
    const svc = new DetectAndEnrollService(d.campaignRepo as any, d.attemptRepo as any, d.suppressionRepo as any, d.jobQueue as any, d.events as any, d.clock);
    await svc.handle(evt);
    expect(d.attemptRepo.save).not.toHaveBeenCalled();
  });
});
