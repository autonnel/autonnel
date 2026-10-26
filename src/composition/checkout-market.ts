import { CURRENCY_COUNTRY, SUPPORTED_PAGE_CURRENCIES } from '@/lib/i18n/page-currencies';
import { getRuntimeEnv } from '@/lib/runtime/env';
import type { Purchasable } from '@/modules/commerce-gateway/domain/value-objects/purchasable';

export interface CheckoutMarket {
  countryCode: string;
  currencyCode: string;
}

// The market the checkout cart is priced in. Anything shown to the buyer before the cart
// (e.g. preselected rows) must use the same market or the displayed price drifts from the charge.
export function checkoutMarket(env: Record<string, unknown> = getRuntimeEnv()): CheckoutMarket {
  return {
    countryCode: (env.DEFAULT_COUNTRY as string | undefined) ?? 'US',
    currencyCode: (env.DEFAULT_CURRENCY as string | undefined) ?? 'USD',
  };
}

export { SUPPORTED_PAGE_CURRENCIES };

export class UnsupportedCurrencyError extends Error {
  constructor(currencyCode: string) {
    super(`Unsupported checkout currency: ${currencyCode}`);
    this.name = 'UnsupportedCurrencyError';
  }
}

export function marketForCurrency(
  currencyCode: string | null | undefined,
  env: Record<string, unknown> = getRuntimeEnv(),
): CheckoutMarket {
  const code = currencyCode?.toUpperCase();
  const defaultMarket = checkoutMarket(env);
  if (!code || code === defaultMarket.currencyCode.toUpperCase()) return defaultMarket;
  if (!Object.hasOwn(CURRENCY_COUNTRY, code)) throw new UnsupportedCurrencyError(code);
  return { countryCode: CURRENCY_COUNTRY[code], currencyCode: code };
}

// Sell unless inventory is explicitly unavailable; "unknown"/stale inventory stays purchasable
// (matches the storefront product display).
export function isSellablePurchasable(p: Purchasable | undefined): p is Purchasable & { price: NonNullable<Purchasable['price']> } {
  return !!p && p.sellability.verdict !== 'unavailable' && !!p.price;
}
