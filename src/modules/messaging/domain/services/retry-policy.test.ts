import { describe, it, expect } from 'vitest';
import { RetryPolicy } from './retry-policy';

describe('RetryPolicy', () => {
  const policy = new RetryPolicy();

  it('classifies 5xx and network errors as transient (retryable)', () => {
    expect(policy.isTransient({ httpStatus: 503 })).toBe(true);
    expect(policy.isTransient({ httpStatus: 429 })).toBe(true);
    expect(policy.isTransient({ network: true })).toBe(true);
  });

  it('classifies 4xx (except 429) as permanent (non-retryable)', () => {
    expect(policy.isTransient({ httpStatus: 400 })).toBe(false);
    expect(policy.isTransient({ httpStatus: 422 })).toBe(false);
  });

  it('a hard-bounce / invalid-recipient signal is permanent', () => {
    expect(policy.isTransient({ httpStatus: 200, hardBounce: true })).toBe(false);
  });
});
