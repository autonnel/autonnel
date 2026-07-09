import { describe, it, expect } from 'vitest';
import { SuppressionEntry } from './suppression';

describe('SuppressionEntry', () => {
  it('keys by (scope, subjectKey) and is permanent when expiresAt is null', () => {
    const e = SuppressionEntry.create({
      scope: 'contact',
      subjectKey: 'h1',
      reason: 'optout',
      source: 'engagement_callback',
      expiresAt: null,
    });
    expect(e.matches('contact', 'h1')).toBe(true);
    expect(e.matches('contact', 'h2')).toBe(false);
    expect(e.isActive(new Date('2030-01-01T00:00:00Z'))).toBe(true);
  });

  it('paid suppression can expire', () => {
    const e = SuppressionEntry.create({
      scope: 'checkout',
      subjectKey: 'sess_1',
      reason: 'paid',
      source: 'payment_captured',
      expiresAt: new Date('2026-06-05T00:00:00Z'),
    });
    expect(e.isActive(new Date('2026-06-04T00:00:00Z'))).toBe(true);
    expect(e.isActive(new Date('2026-06-06T00:00:00Z'))).toBe(false);
  });

  it('maps a Messaging hard bounce to a permanent contact-scope suppression (H2)', () => {
    const e = SuppressionEntry.fromMessagingSuppression({
      channel: 'email',
      normalizedAddress: 'a@b.co',
      hashedIdentity: 'h1',
      messagingReason: 'HardBounce',
    });
    expect(e.scope).toBe('contact');
    expect(e.subjectKey).toBe('h1');
    expect(e.reason).toBe('bounce');
    expect(e.expiresAt).toBeNull();
  });
});
