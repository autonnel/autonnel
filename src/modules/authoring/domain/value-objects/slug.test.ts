import { describe, it, expect } from 'vitest';
import { Slug } from './slug';

describe('Slug', () => {
  it('normalizes to lowercase URL-safe form', () => {
    expect(Slug.of('My Page!').value).toBe('my-page');
  });
  it('collapses repeated separators and trims', () => {
    expect(Slug.of('  a__b  c ').value).toBe('a-b-c');
  });
  it('rejects empty after normalization', () => {
    expect(() => Slug.of('!!!')).toThrow(/slug/i);
  });
  it('equals compares by normalized value', () => {
    expect(Slug.of('Hello World').equals(Slug.of('hello-world'))).toBe(true);
  });
});
