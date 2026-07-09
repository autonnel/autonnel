import { describe, it, expect } from 'vitest';
import { RawOutputSchema } from './agent';

describe('RawOutputSchema', () => {
  const validContent = [
    { type: 'HeroPanel', props: { id: 'h1', headline: 'x' } },
    { type: 'PageFooter', props: { id: 'f1' } },
  ];

  it('accepts content as a proper array', () => {
    const result = RawOutputSchema.safeParse({
      explanation: 'done',
      content: validContent,
      root: { maxWidth: '1080' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toEqual(validContent);
      expect(result.data.root).toEqual({ maxWidth: '1080' });
    }
  });

  it('accepts content as a JSON-stringified array (qwen behavior)', () => {
    const result = RawOutputSchema.safeParse({
      explanation: 'done',
      content: `\n${JSON.stringify(validContent)}\n`,
      root: { maxWidth: '1080' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toEqual(validContent);
    }
  });

  it('accepts root as a JSON-stringified object', () => {
    const result = RawOutputSchema.safeParse({
      content: validContent,
      root: JSON.stringify({ maxWidth: '1080', fontFamily: 'Inter' }),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.root).toEqual({ maxWidth: '1080', fontFamily: 'Inter' });
    }
  });

  it('rejects content when stringified value is not parseable as array', () => {
    const result = RawOutputSchema.safeParse({
      content: 'not-json',
    });
    expect(result.success).toBe(false);
  });

  it('rejects content when stringified value parses to non-array', () => {
    const result = RawOutputSchema.safeParse({
      content: '{"foo": "bar"}',
    });
    expect(result.success).toBe(false);
  });

  it('rejects content items missing type', () => {
    const result = RawOutputSchema.safeParse({
      content: [{ props: {} }],
    });
    expect(result.success).toBe(false);
  });

  it('allows root and rootProps to be absent', () => {
    const result = RawOutputSchema.safeParse({ content: [] });
    expect(result.success).toBe(true);
  });
});
