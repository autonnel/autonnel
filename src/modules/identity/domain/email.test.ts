import { describe, it, expect } from 'vitest';
import { Email } from './email';
import { CredentialHash } from './credential-hash';

describe('Email', () => {
  it('normalizes to lowercase + trimmed for global uniqueness', () => {
    expect(Email.of('  User@Example.COM ').normalized).toBe('user@example.com');
  });

  it('rejects malformed addresses', () => {
    expect(() => Email.of('not-an-email')).toThrow(/email/i);
  });

  it('value equality by normalized form', () => {
    expect(Email.of('a@b.com').equals(Email.of('A@B.com'))).toBe(true);
  });
});

describe('CredentialHash', () => {
  it('is opaque and never reveals its raw string via toString/toJSON', () => {
    const h = CredentialHash.fromStored('pbkdf2$120000$salt$digest');
    expect(h.toString()).toBe('[REDACTED]');
    expect(JSON.stringify({ h })).toBe('{"h":"[REDACTED]"}');
    expect(h.stored).toBe('pbkdf2$120000$salt$digest');
  });
});
