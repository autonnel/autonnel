import { describe, it, expect } from 'vitest';
import { StepSlug } from './routing-rule';

describe('StepSlug', () => {
  it('normalizes', () => expect(StepSlug.of('Step One').value).toBe('step-one'));
  it('rejects empty', () => expect(() => StepSlug.of('  ')).toThrow());
});
