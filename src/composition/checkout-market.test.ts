import { describe, it, expect } from 'vitest';
import { marketForCurrency, SUPPORTED_PAGE_CURRENCIES, UnsupportedCurrencyError } from './checkout-market';

const env = { DEFAULT_COUNTRY: 'US', DEFAULT_CURRENCY: 'USD' };

describe('marketForCurrency', () => {
  it('returns the default market for an empty currency', () => {
    expect(marketForCurrency('', env)).toEqual({ countryCode: 'US', currencyCode: 'USD' });
    expect(marketForCurrency(null, env)).toEqual({ countryCode: 'US', currencyCode: 'USD' });
    expect(marketForCurrency(undefined, env)).toEqual({ countryCode: 'US', currencyCode: 'USD' });
  });

  it('treats the default currency case-insensitively', () => {
    expect(marketForCurrency('usd', env)).toEqual({ countryCode: 'US', currencyCode: 'USD' });
  });

  it('maps a supported currency to its country', () => {
    expect(marketForCurrency('EUR', env)).toEqual({ countryCode: 'DE', currencyCode: 'EUR' });
    expect(marketForCurrency('eur', env)).toEqual({ countryCode: 'DE', currencyCode: 'EUR' });
  });

  it('throws UnsupportedCurrencyError for an unknown currency', () => {
    expect(() => marketForCurrency('XYZ', env)).toThrow(UnsupportedCurrencyError);
  });

  it('rejects zero-decimal currencies because amounts are stored in 1/100 units', () => {
    expect(() => marketForCurrency('JPY', env)).toThrow(UnsupportedCurrencyError);
    expect(SUPPORTED_PAGE_CURRENCIES).not.toContain('JPY');
  });
});
