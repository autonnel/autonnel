import { describe, it, expect } from 'vitest';
import { isMaskedCrossOriginError } from './masked-error';

describe('isMaskedCrossOriginError', () => {
  it('drops the opaque cross-origin sentinel', () => {
    expect(
      isMaskedCrossOriginError({ message: 'Script error.', filename: '', error: null }),
    ).toBe(true);
  });

  it('matches the sentinel case-insensitively and without the trailing period', () => {
    expect(isMaskedCrossOriginError({ message: 'script error', filename: '' })).toBe(true);
    expect(isMaskedCrossOriginError({ message: 'SCRIPT ERROR.', filename: '' })).toBe(true);
  });

  it('drops filename-less, error-less noise (resource load / masked events)', () => {
    expect(isMaskedCrossOriginError({ message: '', filename: '', error: null })).toBe(true);
    expect(isMaskedCrossOriginError({})).toBe(true);
  });

  it('keeps first-party errors that expose a real Error object', () => {
    expect(
      isMaskedCrossOriginError({
        message: 'x is not a function',
        filename: 'https://shop.example.com/_astro/checkout.abc.js',
        error: new TypeError('x is not a function'),
      }),
    ).toBe(false);
  });

  it('keeps errors with a same-origin filename even without an error object', () => {
    expect(
      isMaskedCrossOriginError({
        message: 'Uncaught ReferenceError: foo is not defined',
        filename: 'https://shop.example.com/page',
        error: null,
      }),
    ).toBe(false);
  });

  it('keeps a real error even if its message coincidentally reads "script error"', () => {
    expect(
      isMaskedCrossOriginError({ message: 'Script error.', filename: '', error: new Error('boom') }),
    ).toBe(false);
  });
});
