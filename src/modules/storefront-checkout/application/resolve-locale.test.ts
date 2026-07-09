import { describe, it, expect } from 'vitest';
import { normalizeLocale, localeFromAcceptLanguage, resolveCheckoutLocale } from './resolve-locale';

describe('normalizeLocale', () => {
  it('reduces a region tag to its primary subtag', () => {
    expect(normalizeLocale('fr-FR')).toBe('fr');
    expect(normalizeLocale('de_DE')).toBe('de');
    expect(normalizeLocale('ES')).toBe('es');
  });
  it('returns null for empty or invalid input', () => {
    expect(normalizeLocale('')).toBeNull();
    expect(normalizeLocale(null)).toBeNull();
    expect(normalizeLocale(undefined)).toBeNull();
    expect(normalizeLocale('x')).toBeNull();
    expect(normalizeLocale('123')).toBeNull();
  });
  it('keeps unsupported but well-formed languages (render path clamps to en)', () => {
    expect(normalizeLocale('it')).toBe('it');
  });
});

describe('localeFromAcceptLanguage', () => {
  it('takes the first tag and strips q-weights', () => {
    expect(localeFromAcceptLanguage('fr-FR,fr;q=0.9,en;q=0.8')).toBe('fr');
    expect(localeFromAcceptLanguage('de;q=0.7')).toBe('de');
  });
  it('returns null when header is absent', () => {
    expect(localeFromAcceptLanguage(null)).toBeNull();
    expect(localeFromAcceptLanguage('')).toBeNull();
  });
});

describe('resolveCheckoutLocale', () => {
  it('prefers the explicit client value', () => {
    expect(resolveCheckoutLocale({ explicit: 'de', acceptLanguage: 'fr-FR' })).toBe('de');
  });
  it('falls back to Accept-Language when no explicit value', () => {
    expect(resolveCheckoutLocale({ explicit: null, acceptLanguage: 'es-ES,es;q=0.9' })).toBe('es');
    expect(resolveCheckoutLocale({ explicit: '', acceptLanguage: 'fr' })).toBe('fr');
  });
  it('returns null when neither signal is present', () => {
    expect(resolveCheckoutLocale({})).toBeNull();
    expect(resolveCheckoutLocale({ explicit: 'nonsense-!!' , acceptLanguage: null })).toBeNull();
  });
});
