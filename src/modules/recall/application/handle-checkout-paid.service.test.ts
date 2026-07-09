import { describe, it, expect, vi } from 'vitest';
import { HandleCheckoutPaidService } from './handle-checkout-paid.service';
import { RecallAttempt } from '../domain/recall-attempt';

const makeAttempt = () => {
  const a = RecallAttempt.enroll({
    checkoutRef: 'sess_1',
    campaignRef: 'camp_1',
    campaignVersionRef: 1,
    contact: { hashedIdentity: 'h1', normalizedEmail: 'a@b.co', locale: 'en', consentedChannels: ['email'] },
    frequencyCapMaxTouches: 3,
  });
  a.id = 'att_1';
  a.recordTouchFired({
    touchId: 't1', stepIndex: 0, channel: 'email',
    scheduledFor: new Date('2026-06-04T09:00:00Z'), firedAt: new Date('2026-06-04T09:00:00Z'), messageHandoffRef: 'm1',
  });
  return a;
};

const deps = () => ({
  attemptRepo: {
    findByCheckoutRef: vi.fn().mockResolvedValue([makeAttempt()]),
    save: vi.fn().mockImplementation(async (a) => a),
    findByDedupeKey: vi.fn(), claimDueBatch: vi.fn(),
  },
  suppressionRepo: { findActiveBySubject: vi.fn(), upsert: vi.fn(), list: vi.fn(), remove: vi.fn() },
  events: { publish: vi.fn() },
  appConfig: { getRecallConfig: vi.fn().mockResolvedValue({ enabled: true, quietHours: null, attributionWindowHours: 48 }) },
  clock: { now: () => new Date('2026-06-04T10:00:00Z') },
});

describe('HandleCheckoutPaidService', () => {
  it('marks attempts recovered, suppresses the checkout, and emits RecallRecovered', async () => {
    const d = deps();
    const svc = new HandleCheckoutPaidService(d.attemptRepo as any, d.suppressionRepo as any, d.events as any, d.appConfig as any, d.clock);
    await svc.handle({ saleRef: 'sale_1', checkoutRef: 'sess_1', capturedAt: '2026-06-04T10:00:00Z' });
    const saved = d.attemptRepo.save.mock.calls[0][0];
    expect(saved.status.value).toBe('recovered');
    expect(d.suppressionRepo.upsert).toHaveBeenCalled();
    expect(d.events.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'RecallRecovered' }));
  });

  it('is idempotent: no active attempt -> still suppresses, no recovered event', async () => {
    const d = deps();
    d.attemptRepo.findByCheckoutRef = vi.fn().mockResolvedValue([]);
    const svc = new HandleCheckoutPaidService(d.attemptRepo as any, d.suppressionRepo as any, d.events as any, d.appConfig as any, d.clock);
    await svc.handle({ saleRef: 'sale_1', checkoutRef: 'sess_1', capturedAt: '2026-06-04T10:00:00Z' });
    expect(d.suppressionRepo.upsert).toHaveBeenCalled();
    expect(d.events.publish).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RecallRecovered' }));
  });
});
