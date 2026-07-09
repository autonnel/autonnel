import { describe, it, expect } from 'vitest';
import { ConsentState } from './consent-state';
import { RetryPolicy } from './retry-policy';
import { SealedToken } from './sealed-token';

describe('ConsentState', () => {
  it('GRANTED allows full send; DENIED forbids any send', () => {
    expect(ConsentState.granted().allowsAdStorage()).toBe(true);
    expect(ConsentState.denied().allowsAdStorage()).toBe(false);
    expect(ConsentState.denied().isDenied()).toBe(true);
  });
  it('UNKNOWN allows non-PII only', () => {
    const c = ConsentState.unknown();
    expect(c.allowsAdStorage()).toBe(false);
    expect(c.isDenied()).toBe(false);
  });
});

describe('RetryPolicy', () => {
  const p = RetryPolicy.default();
  it('computes exponential backoff with jitter inside expected bounds', () => {
    const base = p.computeNextDelayMs(1);
    const next = p.computeNextDelayMs(2);
    expect(next).toBeGreaterThan(base * 1.5);
    expect(p.isExhausted(p.maxAttempts)).toBe(true);
    expect(p.isExhausted(p.maxAttempts - 1)).toBe(false);
  });
});

describe('SealedToken', () => {
  it('stores ciphertext + iv + tokenVersion and never exposes plaintext', () => {
    const t = SealedToken.of({ ciphertext: 'deadbeef', iv: 'cafe', tokenVersion: 3 });
    expect(t.tokenVersion).toBe(3);
    expect(JSON.stringify(t)).not.toContain('plain');
  });
});
