import { describe, expect, it } from 'vitest';
import { formatMoney, resolvePageLanguage } from './format-money';

const norm = (s: string) => s.replace(/[  ]/g, ' ');

describe('formatMoney', () => {
  it('formats German euros', () => {
    expect(norm(formatMoney(1234.56, 'EUR', 'de'))).toBe('1.234,56 €');
  });
  it('formats English dollars', () => {
    expect(formatMoney(1234.56, 'USD', 'en')).toBe('$1,234.56');
  });
  it('formats French euros', () => {
    expect(norm(formatMoney(1234.56, 'EUR', 'fr'))).toBe('1 234,56 €');
  });
  it('falls back to en-US for unknown language', () => {
    expect(formatMoney(1234.56, 'USD', 'xx')).toBe('$1,234.56');
  });
  it('falls back to plain text for invalid currency', () => {
    expect(formatMoney(5, 'NOPE!', 'en')).toBe('NOPE! 5.00');
  });
});

describe('resolvePageLanguage', () => {
  it('keeps supported languages and defaults to en', () => {
    expect(resolvePageLanguage('de')).toBe('de');
    expect(resolvePageLanguage('ja')).toBe('en');
    expect(resolvePageLanguage(undefined)).toBe('en');
  });
});
