import { describe, it, expect } from 'vitest';
import {
  CheckoutRef,
  Channel,
  DelayOffset,
  SuppressionScope,
  IncentiveRef,
  AttemptStatus,
} from './value-objects';

describe('Recall value objects', () => {
  it('CheckoutRef rejects empty', () => {
    expect(() => CheckoutRef.of('')).toThrow();
    expect(CheckoutRef.of('sess_123').value).toBe('sess_123');
  });

  it('Channel only accepts the closed vocabulary', () => {
    expect(Channel.of('email').value).toBe('email');
    expect(() => Channel.of('carrier-pigeon' as never)).toThrow();
  });

  it('DelayOffset is non-negative minutes and compares', () => {
    expect(() => DelayOffset.ofMinutes(-1)).toThrow();
    expect(DelayOffset.ofMinutes(1440).minutes).toBe(1440);
    expect(DelayOffset.ofMinutes(60).isBefore(DelayOffset.ofMinutes(120))).toBe(true);
  });

  it('SuppressionScope is closed and IncentiveRef stays opaque', () => {
    expect(SuppressionScope.of('contact').value).toBe('contact');
    expect(() => SuppressionScope.of('nope' as never)).toThrow();
    expect(IncentiveRef.of('inc_abc').value).toBe('inc_abc');
  });

  it('AttemptStatus knows terminal states', () => {
    expect(AttemptStatus.of('active').isTerminal()).toBe(false);
    expect(AttemptStatus.of('recovered').isTerminal()).toBe(true);
    expect(AttemptStatus.of('suppressed').isTerminal()).toBe(true);
    expect(AttemptStatus.of('cancelled').isTerminal()).toBe(true);
    expect(AttemptStatus.of('cold').isTerminal()).toBe(true);
  });
});
