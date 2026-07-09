import { describe, it, expect } from 'vitest';
import { ContactHandle } from './contact-handle';

const fakeHash = (normalized: string) => `h:${normalized}`;

describe('ContactHandle', () => {
  it('normalizes email (lowercase, trim) before hashing', () => {
    const h = ContactHandle.fromEmail('  Buyer@Example.COM ', fakeHash);
    expect(h.channel).toBe('email');
    expect(h.normalized).toBe('buyer@example.com');
    expect(h.hashedIdentity).toBe('h:buyer@example.com');
  });

  it('normalizes phone to E.164-ish digits and computes hash once', () => {
    let calls = 0;
    const counting = (n: string) => {
      calls++;
      return `h:${n}`;
    };
    const h = ContactHandle.fromPhone('+1 (415) 555-0100', counting);
    expect(h.channel).toBe('phone');
    expect(h.normalized).toBe('+14155550100');
    expect(h.hashedIdentity).toBe('h:+14155550100');
    expect(calls).toBe(1);
  });

  it('is immutable — rehydration keeps the frozen hash, never recomputes', () => {
    const h = ContactHandle.rehydrate('email', 'buyer@example.com', 'h:frozen');
    expect(h.hashedIdentity).toBe('h:frozen');
  });

  it('rejects an empty handle', () => {
    expect(() => ContactHandle.fromEmail('   ', fakeHash)).toThrow(/empty/i);
  });
});
