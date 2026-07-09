import { describe, it, expect } from 'vitest';
import { JwsTokenSigner } from './jws-token-signer';

describe('JwsTokenSigner', () => {
  const signer = new JwsTokenSigner('test-secret-please-change');
  it('signs and verifies a sessionId claim', async () => {
    const token = await signer.sign({ sessionId: 's1' });
    expect(await signer.verify(token)).toEqual({ sessionId: 's1' });
  });
  it('rejects a tampered token', async () => {
    const token = await signer.sign({ sessionId: 's1' });
    expect(await signer.verify(token + 'x')).toBeNull();
  });
  it('rejects a token signed with a different secret', async () => {
    const other = new JwsTokenSigner('different-secret');
    expect(await other.verify(await signer.sign({ sessionId: 's1' }))).toBeNull();
  });
  it('rejects a malformed token', async () => {
    expect(await signer.verify('not-a-token')).toBeNull();
  });
});
