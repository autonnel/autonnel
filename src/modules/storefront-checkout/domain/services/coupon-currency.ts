import type { CouponDefinition } from './coupon-evaluation-service';

export interface CurrencyRates {
  baseCurrency: string;
  rates: Record<string, number>;
}

export class CouponCurrencyUnsupportedError extends Error {
  constructor() {
    super('Coupon is not available for this currency');
    this.name = 'CouponCurrencyUnsupportedError';
  }
}

// Same list as picocart's auto-pricing; amounts there are whole units (multiples of 100 minor).
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'HUF']);
const WHOLE_UNIT = 100;
const EPSILON = 1e-9;

function isZeroDecimal(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
}

// A discount never exceeds the promised value; a minimum never drops below it.
function convertDiscount(minor: number, rate: number, currency: string): number {
  const x = minor * rate;
  return isZeroDecimal(currency) ? Math.floor(x / WHOLE_UNIT + EPSILON) * WHOLE_UNIT : Math.round(x);
}

function convertMinimum(minor: number, rate: number, currency: string): number {
  const x = minor * rate;
  return isZeroDecimal(currency) ? Math.ceil(x / WHOLE_UNIT - EPSILON) * WHOLE_UNIT : Math.round(x);
}

function sameCurrency(a: string, b: string): boolean {
  return a.toUpperCase() === b.toUpperCase();
}

function rateFor(cartCurrency: string, rates: CurrencyRates | null): number | null {
  const rate = rates?.rates[cartCurrency.toUpperCase()];
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null;
}

// Coupon amounts are defined in the backend's base currency; fixed values and minimums are
// converted into the cart currency and never applied at face value.
export function toCartCurrency(def: CouponDefinition, cartCurrency: string, rates: CurrencyRates | null): CouponDefinition {
  if (rates && sameCurrency(rates.baseCurrency, cartCurrency)) return def;
  if (def.kind === 'percentage' && def.minSubtotalMinor === 0) return def;
  const rate = rateFor(cartCurrency, rates);
  if (rate === null) throw new CouponCurrencyUnsupportedError();
  return {
    ...def,
    value: def.kind === 'fixed' ? convertDiscount(def.value, rate, cartCurrency) : def.value,
    minSubtotalMinor: convertMinimum(def.minSubtotalMinor, rate, cartCurrency),
  };
}

// Largest base amount whose converted minimum fits in the cart subtotal. convertMinimum is
// monotone, so `base >= min` holds exactly when `subtotal >= convertMinimum(min)` (the apply-time check).
export function toBaseSubtotal(subtotalMinor: number, cartCurrency: string, rates: CurrencyRates | null): number | null {
  if (rates && sameCurrency(rates.baseCurrency, cartCurrency)) return subtotalMinor;
  const rate = rateFor(cartCurrency, rates);
  if (rate === null) return null;
  let base = Math.max(0, Math.floor((subtotalMinor + 0.5) / rate));
  while (convertMinimum(base + 1, rate, cartCurrency) <= subtotalMinor) base += 1;
  while (base > 0 && convertMinimum(base, rate, cartCurrency) > subtotalMinor) base -= 1;
  return base;
}
