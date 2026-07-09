import { describe, it, expect } from 'vitest';
import { SuppressionResolver } from './suppression-resolver';
import { RecoveryAttributor } from './recovery-attributor';
import { SuppressionEntry } from '../suppression';
import { RecallAttempt } from '../recall-attempt';

describe('SuppressionResolver', () => {
  it('maps a Messaging RecipientSuppressed event to a Recall suppression (H2)', () => {
    const r = new SuppressionResolver();
    const entry = r.fromMessagingEvent({
      channel: 'email',
      normalizedAddress: 'a@b.co',
      hashedIdentity: 'h1',
      messagingReason: 'HardBounce',
    });
    expect(entry.scope).toBe('contact');
    expect(entry.subjectKey).toBe('h1');
    expect(entry.reason).toBe('bounce');
  });

  it('blocks a Touch when an active suppression matches the contact', () => {
    const r = new SuppressionResolver();
    const supp = [
      SuppressionEntry.create({
        scope: 'contact',
        subjectKey: 'h1',
        reason: 'optout',
        source: 'engagement_callback',
        expiresAt: null,
      }),
    ];
    expect(r.isBlocked({ hashedIdentity: 'h1', checkoutRef: 'sess_1' }, supp, new Date('2026-06-04T10:00:00Z'))).toBe(true);
    expect(r.isBlocked({ hashedIdentity: 'h2', checkoutRef: 'sess_9' }, supp, new Date('2026-06-04T10:00:00Z'))).toBe(false);
  });
});

describe('RecoveryAttributor', () => {
  it('credits recovery to the most recently fired Touch within the window', () => {
    const attempt = RecallAttempt.enroll({
      checkoutRef: 'sess_1',
      campaignRef: 'camp_1',
      campaignVersionRef: 1,
      contact: { hashedIdentity: 'h1', normalizedEmail: 'a@b.co', locale: 'en', consentedChannels: ['email'] },
      frequencyCapMaxTouches: 3,
    });
    attempt.recordTouchFired({
      touchId: 't1',
      stepIndex: 0,
      channel: 'email',
      scheduledFor: new Date('2026-06-04T10:00:00Z'),
      firedAt: new Date('2026-06-04T10:00:00Z'),
      messageHandoffRef: 'm1',
    });
    const attributor = new RecoveryAttributor();
    const result = attributor.attribute(attempt, new Date('2026-06-04T12:00:00Z'), 48);
    expect(result.recovered).toBe(true);
    expect(result.attributedTouchId).toBe('t1');
  });

  it('does not attribute when the last Touch is older than the attribution window', () => {
    const attempt = RecallAttempt.enroll({
      checkoutRef: 'sess_1',
      campaignRef: 'camp_1',
      campaignVersionRef: 1,
      contact: { hashedIdentity: 'h1', normalizedEmail: 'a@b.co', locale: 'en', consentedChannels: ['email'] },
      frequencyCapMaxTouches: 3,
    });
    attempt.recordTouchFired({
      touchId: 't1',
      stepIndex: 0,
      channel: 'email',
      scheduledFor: new Date('2026-06-01T10:00:00Z'),
      firedAt: new Date('2026-06-01T10:00:00Z'),
      messageHandoffRef: 'm1',
    });
    const attributor = new RecoveryAttributor();
    const result = attributor.attribute(attempt, new Date('2026-06-04T12:00:00Z'), 48);
    expect(result.recovered).toBe(true);
    expect(result.attributedTouchId).toBeNull();
  });
});
