import { describe, it, expect } from 'vitest';
import { AbandonmentDetector } from './abandonment-detector';
import { EligibilityEvaluator } from './eligibility-evaluator';
import { SuppressionEntry } from '../suppression';
import type { ContactSnapshot } from '../value-objects';

const contact: ContactSnapshot = {
  hashedIdentity: 'h1',
  normalizedEmail: 'a@b.co',
  locale: 'en',
  consentedChannels: ['email'],
};

describe('AbandonmentDetector (eligibility only)', () => {
  it('is eligible only when a contact handle is present (Storefront owns the FACT)', () => {
    const det = new AbandonmentDetector();
    expect(
      det.isEnrollable({ checkoutRef: 'sess_1', contact, cartValueMinor: 5000 }, { requireContactHandle: true }),
    ).toBe(true);
    expect(
      det.isEnrollable(
        { checkoutRef: 'sess_1', contact: undefined, cartValueMinor: 5000 },
        { requireContactHandle: true },
      ),
    ).toBe(false);
  });

  it('respects a minimum cart value rule', () => {
    const det = new AbandonmentDetector();
    expect(
      det.isEnrollable({ checkoutRef: 'sess_1', contact, cartValueMinor: 100 }, {
        requireContactHandle: true,
        minCartValueMinor: 5000,
      }),
    ).toBe(false);
  });
});

describe('EligibilityEvaluator', () => {
  it('skips enrollment when an active contact-scope suppression exists', () => {
    const ev = new EligibilityEvaluator();
    const supp = [
      SuppressionEntry.create({
        scope: 'contact',
        subjectKey: 'h1',
        reason: 'optout',
        source: 'engagement_callback',
        expiresAt: null,
      }),
    ];
    const verdict = ev.evaluate({
      contact,
      checkoutRef: 'sess_1',
      activeSuppressions: supp,
      now: new Date('2026-06-04T10:00:00Z'),
    });
    expect(verdict.enroll).toBe(false);
    expect(verdict.reason).toBe('suppressed');
  });

  it('enrolls when no suppression matches', () => {
    const ev = new EligibilityEvaluator();
    const verdict = ev.evaluate({
      contact,
      checkoutRef: 'sess_1',
      activeSuppressions: [],
      now: new Date('2026-06-04T10:00:00Z'),
    });
    expect(verdict.enroll).toBe(true);
  });
});
