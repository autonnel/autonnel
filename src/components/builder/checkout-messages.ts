import { t, type TranslationKey } from './translations';
import { formatMoney } from '@/lib/i18n/format-money';

const EXACT_MESSAGE_KEYS: Record<string, TranslationKey> = {
  'Variant is not sellable': 'checkout.productUnavailable',
  'Upsell variant is not sellable': 'checkout.productUnavailable',
  'Cannot assemble a checkout from an empty cart': 'checkout.chooseProduct',
  'Cart contains mixed currencies': 'checkout.mixedCurrencies',
  'PriceSnapshot is stale; re-resolve before capture': 'checkout.priceChanged',
  'Coupon is not available for this currency': 'coupon.currencyUnsupported',
  'Coupon is not active': 'coupon.notActive',
  'Coupon has expired': 'coupon.expired',
  'Coupon usage limit reached': 'coupon.usageLimit',
  'Subtotal below coupon minimum': 'coupon.minNotMet',
  'Invalid coupon': 'orderSummary.invalidCoupon',
  'Invalid coupon code': 'orderSummary.invalidCoupon',
  'Coupon not found': 'orderSummary.invalidCoupon',
  'Unknown coupon code': 'orderSummary.invalidCoupon',
  'Coupon is not redeemable': 'orderSummary.invalidCoupon',
};

const MIN_ORDER = /^Order must be at least (.+)$/;
const UNSUPPORTED_CURRENCY = /(?:currenc(?:y|ies)[^.]*(?:not (?:supported|accepted|allowed|enabled)|unsupported|invalid|unknown)|(?:unsupported|invalid|unknown|unavailable)\s+currenc)/i;

export function isUnsupportedCurrencyMessage(message: string): boolean {
  return UNSUPPORTED_CURRENCY.test(message);
}

export function translateCheckoutMessage(
  lang: string,
  message: string | undefined | null,
  fallbackKey?: TranslationKey,
): string {
  const text = (message ?? '').trim();
  if (!text) return fallbackKey ? t(lang, fallbackKey) : '';
  const exact = EXACT_MESSAGE_KEYS[text];
  if (exact) return t(lang, exact);
  const minOrder = MIN_ORDER.exec(text);
  if (minOrder) return t(lang, 'coupon.minOrder', { amount: minOrder[1] });
  if (isUnsupportedCurrencyMessage(text)) return t(lang, 'payment.currencyNotSupported');
  return text;
}

export interface CouponRejection {
  error?: string | null;
  minOrder?: { amountMinor: number; currencyCode: string };
}

// A missed minimum is shown as money in the cart currency; the server text carries the base amount.
export function couponErrorMessage(lang: string, rejection: CouponRejection): string {
  const min = rejection.minOrder;
  if (min && Number.isFinite(min.amountMinor) && min.currencyCode) {
    return t(lang, 'coupon.minOrder', { amount: formatMoney(min.amountMinor / 100, min.currencyCode, lang) });
  }
  return translateCheckoutMessage(lang, rejection.error);
}
