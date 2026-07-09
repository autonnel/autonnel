import { describe, it, expect } from 'vitest';
import { RetrySchedule } from './retry-schedule';

describe('RetrySchedule', () => {
  const now = new Date('2026-06-04T00:00:00.000Z');

  it('computes exponential backoff from a base delay', () => {
    const s = RetrySchedule.of({ baseDelaySeconds: 60, maxAttempts: 5 });
    expect(s.computeNext(1, now)?.getTime()).toBe(now.getTime() + 60_000);
    expect(s.computeNext(2, now)?.getTime()).toBe(now.getTime() + 120_000);
    expect(s.computeNext(3, now)?.getTime()).toBe(now.getTime() + 240_000);
  });

  it('returns null once maxAttempts is exhausted (no further retry)', () => {
    const s = RetrySchedule.of({ baseDelaySeconds: 60, maxAttempts: 3 });
    expect(s.computeNext(3, now)).toBeNull();
    expect(s.computeNext(4, now)).toBeNull();
  });

  it('clamps backoff at a max ceiling', () => {
    const s = RetrySchedule.of({ baseDelaySeconds: 60, maxAttempts: 10, maxDelaySeconds: 300 });
    expect(s.computeNext(8, now)?.getTime()).toBe(now.getTime() + 300_000);
  });
});
