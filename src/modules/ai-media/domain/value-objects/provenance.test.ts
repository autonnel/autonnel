import { describe, it, expect } from 'vitest';
import { Provenance } from './provenance';

describe('Provenance', () => {
  it('requires jobId, provider, modelId and promptHash', () => {
    expect(() => Provenance.create({ jobId: '', provider: 'openai', modelId: 'm', promptHash: 'h' }))
      .toThrow(/jobId/i);
  });

  it('is frozen', () => {
    const p = Provenance.create({ jobId: 'j', provider: 'openai', modelId: 'm', promptHash: 'h' });
    expect(Object.isFrozen(p)).toBe(true);
  });
});
