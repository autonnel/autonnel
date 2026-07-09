import { describe, it, expect } from 'vitest';
import { WebCryptoSecretGenerator } from './web-crypto-secret-generator';

describe('WebCryptoSecretGenerator', () => {
  const gen = new WebCryptoSecretGenerator();
  it('generates unguessable prefixed secrets', () => {
    const a = gen.generatePlaintext();
    const b = gen.generatePlaintext();
    expect(a).toMatch(/^ak_/);
    expect(a).not.toBe(b);
  });
  it('hashSecret is deterministic; constantTimeEquals matches', async () => {
    const h1 = await gen.hashSecret('ak_abc.secret');
    const h2 = await gen.hashSecret('ak_abc.secret');
    expect(h1).toBe(h2);
    expect(gen.constantTimeEquals(h1, h2)).toBe(true);
    expect(gen.constantTimeEquals(h1, 'different')).toBe(false);
  });
});
