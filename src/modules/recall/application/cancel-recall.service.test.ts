import { describe, it, expect, vi } from 'vitest';
import { CancelRecallService } from './cancel-recall.service';
import { RecallAttempt } from '../domain/recall-attempt';
import type { RecallAttemptRepository, EventPublisherPort } from './ports';

function makeAttempt(overrides?: Partial<ReturnType<typeof RecallAttempt.enroll>>) {
  const a = RecallAttempt.enroll({
    checkoutRef: 'sess_1',
    campaignRef: 'camp_1',
    campaignVersionRef: 1,
    contact: { hashedIdentity: 'h1', normalizedEmail: 'a@b.co', locale: 'en', consentedChannels: ['email'] },
    frequencyCapMaxTouches: 3,
    ...overrides,
  });
  a.id = 'att_1';
  return a;
}

describe('CancelRecallService', () => {
  it('cancels active attempts and publishes RecallAttemptCancelled', async () => {
    const attempt = makeAttempt();
    const repo: RecallAttemptRepository = {
      findByCheckoutRef: vi.fn().mockResolvedValue([attempt]),
      save: vi.fn().mockImplementation(async (a) => a),
      findByDedupeKey: vi.fn(),
      claimDueBatch: vi.fn(),
    };
    const events: EventPublisherPort = { publish: vi.fn() };
    const svc = new CancelRecallService(repo, events);

    await svc.cancelByCheckoutRef('sess_1');

    expect(repo.findByCheckoutRef).toHaveBeenCalledExactlyOnceWith('sess_1');
    expect(repo.save).toHaveBeenCalledOnce();
    const saved: RecallAttempt = (repo.save as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(saved.status.value).toBe('cancelled');
    expect(events.publish).toHaveBeenCalledExactlyOnceWith({
      type: 'RecallAttemptCancelled',
      payload: { checkoutRef: 'sess_1' },
    });
  });

  it('skips already-terminal attempts (does not save, does not publish)', async () => {
    const attempt = makeAttempt();
    attempt.suppress('paid'); // now status === 'suppressed' (terminal)
    const repo: RecallAttemptRepository = {
      findByCheckoutRef: vi.fn().mockResolvedValue([attempt]),
      save: vi.fn(),
      findByDedupeKey: vi.fn(),
      claimDueBatch: vi.fn(),
    };
    const events: EventPublisherPort = { publish: vi.fn() };
    const svc = new CancelRecallService(repo, events);

    await svc.cancelByCheckoutRef('sess_1');

    expect(repo.save).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('handles empty attempt list silently', async () => {
    const repo: RecallAttemptRepository = {
      findByCheckoutRef: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
      findByDedupeKey: vi.fn(),
      claimDueBatch: vi.fn(),
    };
    const events: EventPublisherPort = { publish: vi.fn() };
    const svc = new CancelRecallService(repo, events);

    await svc.cancelByCheckoutRef('sess_1');

    expect(repo.save).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });
});
