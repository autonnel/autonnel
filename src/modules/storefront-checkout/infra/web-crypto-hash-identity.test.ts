import { describe, it, expect } from 'vitest';
import { WebCryptoHashIdentityAdapter } from './web-crypto-hash-identity';

describe('WebCryptoHashIdentityAdapter', () => {
  const adapter = new WebCryptoHashIdentityAdapter();

  it('produces a stable lowercase hex SHA-256 digest', async () => {
    const a = await adapter.digest('buyer@example.com');
    const b = await adapter.digest('buyer@example.com');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different digests for different inputs', async () => {
    const a = await adapter.digest('a@example.com');
    const b = await adapter.digest('b@example.com');
    expect(a).not.toBe(b);
  });

  it('exposes a sync closure factory that returns the precomputed digest once', async () => {
    const fn = await adapter.hasherFor('buyer@example.com');
    expect(fn('buyer@example.com')).toMatch(/^[0-9a-f]{64}$/);
  });
});
