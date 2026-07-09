import { describe, it, expect } from 'vitest';
import { CookieSigner } from './cookie-signer';

describe('CookieSigner', () => {
  it('round-trips the session id through sign then verify', async () => {
    const signer = new CookieSigner('s3cr3t');
    const signed = await signer.sign('sess_1');
    expect(signed.startsWith('sess_1.')).toBe(true);
    expect(await signer.verify(signed)).toBe('sess_1');
  });

  it('returns null for a tampered suffix', async () => {
    const signer = new CookieSigner('s3cr3t');
    const signed = await signer.sign('sess_1');
    const tampered = `${signed.slice(0, -1)}${signed.endsWith('0') ? '1' : '0'}`;
    expect(await signer.verify(tampered)).toBeNull();
  });

  it('returns null when verified under a different secret', async () => {
    const signed = await new CookieSigner('s3cr3t').sign('sess_1');
    expect(await new CookieSigner('other').verify(signed)).toBeNull();
  });

  it('returns null for a value with no separator', async () => {
    const signer = new CookieSigner('s3cr3t');
    expect(await signer.verify('no-dot-here')).toBeNull();
  });
});
