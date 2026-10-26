// Amounts are stored and charged in 1/100 units, so zero-decimal currencies (JPY, KRW, ...) must not be listed.
export const CURRENCY_COUNTRY: Record<string, string> = {
  USD: 'US',
  EUR: 'DE',
  GBP: 'GB',
  CAD: 'CA',
  AUD: 'AU',
  NZD: 'NZ',
  CNY: 'CN',
  CHF: 'CH',
  SEK: 'SE',
  NOK: 'NO',
  DKK: 'DK',
  PLN: 'PL',
  SGD: 'SG',
  HKD: 'HK',
  MXN: 'MX',
  BRL: 'BR',
  INR: 'IN',
};


export const SUPPORTED_PAGE_CURRENCIES = Object.keys(CURRENCY_COUNTRY);
