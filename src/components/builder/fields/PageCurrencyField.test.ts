import { describe, it, expect } from 'vitest';
import { currencyOptions } from './PageCurrencyField';

describe('currencyOptions', () => {
  it('never offers zero-decimal currencies', () => {
    expect(currencyOptions(['USD', 'JPY', 'EUR']).map((o) => o.value)).toEqual(['', 'USD', 'EUR']);
  });
});
