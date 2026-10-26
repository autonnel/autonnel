import { normalizeCurrencyCode } from '@/lib/storefront/checkout-currency';
import { checkoutMarket } from './checkout-market';
import { checkoutSessionCurrency } from './storefront-runtime';

export interface CheckoutCurrencyInput {
  pageType: string;
  pageCurrency: unknown;
  sessionCookie: string | null;
  locals?: unknown;
}

export interface CheckoutCurrencyDeps {
  sessionCurrency(cookieValue: string | null, locals?: unknown): Promise<string | null>;
  defaultCurrency(): string;
}

const defaultDeps: CheckoutCurrencyDeps = {
  sessionCurrency: checkoutSessionCurrency,
  defaultCurrency: () => checkoutMarket().currencyCode,
};

// Upsell pages charge in the frozen market of the session that paid the first order; every
// other page creates its own session priced in the page currency.
export async function resolveStorefrontCheckoutCurrency(
  input: CheckoutCurrencyInput,
  deps: CheckoutCurrencyDeps = defaultDeps,
): Promise<string> {
  if (input.pageType === 'UPSELL') {
    const session = normalizeCurrencyCode(await deps.sessionCurrency(input.sessionCookie, input.locals));
    if (session) return session;
  }
  return normalizeCurrencyCode(input.pageCurrency) || deps.defaultCurrency().toUpperCase();
}
