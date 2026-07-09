import { describe, it, expect } from 'vitest';
import { DEFERRED_CONTACT_EMAIL, isDeferredContactNormalized } from './deferred-contact';

describe('isDeferredContactNormalized', () => {
  it('is true for the deferred sentinel', () => {
    expect(isDeferredContactNormalized(DEFERRED_CONTACT_EMAIL)).toBe(true);
  });

  it('is false for a real email', () => {
    expect(isDeferredContactNormalized('ada@example.com')).toBe(false);
  });
});
