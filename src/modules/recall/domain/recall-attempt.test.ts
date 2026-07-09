import { describe, it, expect } from 'vitest';
import { RecallAttempt } from './recall-attempt';

const enroll = () =>
  RecallAttempt.enroll({
    checkoutRef: 'sess_1',
    campaignRef: 'camp_1',
    campaignVersionRef: 1,
    contact: { hashedIdentity: 'h1', normalizedEmail: 'a@b.co', locale: 'en', consentedChannels: ['email'] },
    incentiveRef: undefined,
    frequencyCapMaxTouches: 3,
  });

describe('RecallAttempt', () => {
  it('enrolls active with nextStepIndex 0 and bound version', () => {
    const a = enroll();
    expect(a.status.value).toBe('active');
    expect(a.nextStepIndex).toBe(0);
    expect(a.campaignVersionRef).toBe(1);
  });

  it('fires a Touch idempotently on touchId', () => {
    const a = enroll();
    a.recordTouchFired({
      touchId: 't1',
      stepIndex: 0,
      channel: 'email',
      scheduledFor: new Date('2026-06-04T10:00:00Z'),
      firedAt: new Date('2026-06-04T10:00:01Z'),
      messageHandoffRef: 'm1',
    });
    expect(a.touches).toHaveLength(1);
    expect(a.nextStepIndex).toBe(1);
    a.recordTouchFired({
      touchId: 't1',
      stepIndex: 0,
      channel: 'email',
      scheduledFor: new Date('2026-06-04T10:00:00Z'),
      firedAt: new Date('2026-06-04T10:00:02Z'),
      messageHandoffRef: 'm1',
    });
    expect(a.touches).toHaveLength(1);
    expect(a.nextStepIndex).toBe(1);
  });

  it('suppresses immediately on paid and refuses further Touches', () => {
    const a = enroll();
    a.suppress('paid');
    expect(a.status.value).toBe('suppressed');
    expect(() =>
      a.recordTouchFired({
        touchId: 't2',
        stepIndex: 0,
        channel: 'email',
        scheduledFor: new Date(),
        firedAt: new Date(),
        messageHandoffRef: 'm2',
      }),
    ).toThrow(/terminal/i);
  });

  it('marks recovered (recovery wins) from active', () => {
    const a = enroll();
    a.markRecovered();
    expect(a.status.value).toBe('recovered');
  });
});
