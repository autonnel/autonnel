import { describe, it, expect } from 'vitest';
import { WorkersTokenCipher } from './workers-token-cipher';

describe('WorkersTokenCipher', () => {
  const keyBytes = new Uint8Array(32).fill(7);

  it('round-trips a token and never stores plaintext in the sealed value', async () => {
    const cipher = await WorkersTokenCipher.fromRawKey(keyBytes);
    const sealed = await cipher.seal('refresh-token-secret', 2);
    expect(sealed.tokenVersion).toBe(2);
    expect(sealed.ciphertext).not.toContain('refresh-token-secret');
    const opened = await cipher.open(sealed);
    expect(opened).toBe('refresh-token-secret');
  });

  it('produces a fresh iv per seal (non-deterministic ciphertext)', async () => {
    const cipher = await WorkersTokenCipher.fromRawKey(keyBytes);
    const a = await cipher.seal('x', 1);
    const b = await cipher.seal('x', 1);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
});
