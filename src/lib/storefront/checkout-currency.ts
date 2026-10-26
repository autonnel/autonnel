// The currency the storefront cart is priced in, injected server-side so islands display the
// same prices the checkout charges (on upsell pages this is the paid session's market).
export const CHECKOUT_CURRENCY_GLOBAL = '__AUTONNEL_CHECKOUT_CURRENCY__';

const CURRENCY_CODE = /^[A-Za-z]{3}$/;

export function normalizeCurrencyCode(value: unknown): string {
  return typeof value === 'string' && CURRENCY_CODE.test(value) ? value.toUpperCase() : '';
}

export function injectedCheckoutCurrency(): string {
  if (typeof window === 'undefined') return '';
  return normalizeCurrencyCode((window as unknown as Record<string, unknown>)[CHECKOUT_CURRENCY_GLOBAL]);
}
