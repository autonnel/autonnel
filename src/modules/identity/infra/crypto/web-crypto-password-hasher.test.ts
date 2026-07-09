import { describe, it, expect } from 'vitest';
import { WebCryptoPasswordHasher } from './web-crypto-password-hasher';

describe('WebCryptoPasswordHasher', () => {
  const hasher = new WebCryptoPasswordHasher();
  it('hash then verify round-trips for the correct password', async () => {
    const h = await hasher.hash('secret123');
    expect(await hasher.verify('secret123', h)).toBe(true);
  });
  it('verify fails for a wrong password', async () => {
    const h = await hasher.hash('secret123');
    expect(await hasher.verify('wrong', h)).toBe(false);
  });
  it('produces salted output (two hashes of same input differ)', async () => {
    const a = await hasher.hash('same');
    const b = await hasher.hash('same');
    expect(a.stored).not.toBe(b.stored);
  });
});
