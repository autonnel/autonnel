import { describe, expect, it } from 'vitest';
import byLocale, { t, type SupportedLanguage, type TranslationKey } from './translations';
import { translateCheckoutMessage } from './checkout-messages';

const LANGUAGES: SupportedLanguage[] = ['en', 'de', 'fr', 'es'];

describe('translation catalog', () => {
  it('every key has 4 non-empty translations', () => {
    const keys = Object.keys(byLocale.en) as TranslationKey[];
    expect(keys.length).toBeGreaterThan(0);
    for (const lang of LANGUAGES) {
      for (const key of keys) {
        expect(byLocale[lang][key], `${lang}:${key}`).toBeTruthy();
        expect(byLocale[lang][key].trim().length, `${lang}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('translates the unsupported currency payment error', () => {
    expect(t('en', 'payment.currencyNotSupported')).toBe('This payment method does not support the selected currency.');
    expect(t('de', 'payment.currencyNotSupported')).toMatch(/Zahlungsmethode/);
    expect(t('fr', 'payment.currencyNotSupported')).toMatch(/devise/);
    expect(t('es', 'payment.currencyNotSupported')).toMatch(/moneda/);
  });

  it('keeps placeholders consistent across languages', () => {
    const keys = Object.keys(byLocale.en) as TranslationKey[];
    for (const key of keys) {
      const names = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      for (const lang of LANGUAGES) {
        expect(names(byLocale[lang][key]), `${lang}:${key}`).toBe(names(byLocale.en[key]));
      }
    }
  });
});

describe('translateCheckoutMessage', () => {
  it('maps known server messages to the page language', () => {
    expect(translateCheckoutMessage('de', 'Coupon is not available for this currency')).toBe(
      t('de', 'coupon.currencyUnsupported'),
    );
    expect(translateCheckoutMessage('fr', 'Variant is not sellable')).toBe(t('fr', 'checkout.productUnavailable'));
    expect(translateCheckoutMessage('es', 'Upsell variant is not sellable')).toBe(t('es', 'checkout.productUnavailable'));
    expect(translateCheckoutMessage('de', 'Order must be at least 25')).toBe(t('de', 'coupon.minOrder', { amount: '25' }));
  });

  it('maps unsupported currency gateway errors', () => {
    expect(translateCheckoutMessage('de', 'Currency JPY is not supported')).toBe(t('de', 'payment.currencyNotSupported'));
    expect(translateCheckoutMessage('fr', 'unsupported currency')).toBe(t('fr', 'payment.currencyNotSupported'));
    expect(translateCheckoutMessage('en', 'Invalid currency code: XYZ')).toBe(t('en', 'payment.currencyNotSupported'));
  });

  it('passes unknown messages through and falls back to the fallback key for empty ones', () => {
    expect(translateCheckoutMessage('de', 'Something odd happened')).toBe('Something odd happened');
    expect(translateCheckoutMessage('de', '', 'checkout.startFailed')).toBe(t('de', 'checkout.startFailed'));
  });
});
