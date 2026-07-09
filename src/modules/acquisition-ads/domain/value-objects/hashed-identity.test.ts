import { describe, it, expect } from 'vitest';
import { HashedIdentity } from './hashed-identity';

describe('HashedIdentity', () => {
  const sha = 'a'.repeat(64);

  it('wraps a 64-hex SHA-256 from the propagated ContactHandle', () => {
    const h = HashedIdentity.fromContactHandle({ emailSha256: sha, phoneSha256: undefined });
    expect(h.email).toBe(sha);
    expect(h.phone).toBeUndefined();
    expect(h.isEmpty()).toBe(false);
  });

  it('rejects values that are not 64-char lowercase hex (defends against raw PII leaking in)', () => {
    expect(() => HashedIdentity.fromContactHandle({ emailSha256: 'buyer@example.com' })).toThrow(
      /not a SHA-256 hash/,
    );
  });

  it('isEmpty() is true when neither email nor phone hash is present', () => {
    expect(HashedIdentity.fromContactHandle({}).isEmpty()).toBe(true);
  });
});
