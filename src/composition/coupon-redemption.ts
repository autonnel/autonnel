import { Money } from '@/modules/shared-kernel/money';
import { createLogger } from '@/lib/logger';
import { CouponEvaluationService, SubtotalBelowMinimumError, type CouponDefinition, type CouponMinimum } from '@/modules/storefront-checkout/domain/services/coupon-evaluation-service';
import { CouponCurrencyUnsupportedError, toBaseSubtotal, toCartCurrency, type CurrencyRates } from '@/modules/storefront-checkout/domain/services/coupon-currency';
import { CouponNotRedeemableError } from '@/modules/storefront-checkout/application/submit-checkout-service';

const logger = createLogger('CouponRedemption');
const MAJOR_TO_MINOR = 100;
// Coupon.evaluate's minimum message; it is checked after active/expiry/usage, so only it means "below minimum".
const MIN_ORDER_FAILURE = /^Order must be at least /;

export interface CouponRecord {
  id?: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderAmount: number | null;
}

export interface CouponRedemptionDeps {
  rates(cartCurrency: string): Promise<CurrencyRates | null>;
  // Authoritative check (active, expiry, usage, minimum) with a subtotal in base minor units.
  // An invalid result still carries the coupon when it exists, so a missed minimum can be reported.
  evaluate(code: string, baseSubtotalMinor: number, now: Date): Promise<{ valid: boolean; error?: string; coupon?: CouponRecord }>;
}

// Same failure as CouponNotRedeemableError, plus the minimum the buyer must reach in the cart currency.
export class CouponMinimumNotMetError extends CouponNotRedeemableError {
  constructor(message: string, readonly minOrder: CouponMinimum) {
    super(message);
  }
}

function minimumInCartCurrency(
  coupon: CouponRecord,
  baseSubtotal: number | null,
  currencyCode: string,
  rates: CurrencyRates | null,
): CouponMinimum | null {
  const def = toCouponDefinition(coupon);
  if (baseSubtotal === null || def.minSubtotalMinor === 0 || baseSubtotal >= def.minSubtotalMinor) return null;
  try {
    return { amountMinor: toCartCurrency(def, currencyCode, rates).minSubtotalMinor, currencyCode: currencyCode.toUpperCase() };
  } catch {
    return null;
  }
}

export function toCouponDefinition(c: CouponRecord): CouponDefinition {
  return {
    code: c.code,
    kind: c.discountType === 'PERCENTAGE' ? 'percentage' : 'fixed',
    // percentage stays as the raw percent; fixed value is stored in major units → minor.
    value: c.discountType === 'PERCENTAGE' ? c.discountValue : Math.round(c.discountValue * MAJOR_TO_MINOR),
    minSubtotalMinor: c.minOrderAmount === null ? 0 : Math.round(c.minOrderAmount * MAJOR_TO_MINOR),
  };
}

// Coupon amounts live in the backend's base currency. A backend without a rates concept
// (Shopify / Woo single-currency stores) means coupons are in the store default currency. A
// failed rates read is "no rate": a default base is never assumed for it.
export async function couponRatesFor(
  readRates: () => Promise<CurrencyRates | null>,
  cartCurrency: string,
  defaultCurrency: string,
): Promise<CurrencyRates | null> {
  let rates: CurrencyRates | null;
  try {
    rates = await readRates();
  } catch (err) {
    logger.warn('Currency rates unavailable; coupons needing a rate are rejected', { error: err });
    return null;
  }
  if (rates) return rates;
  return cartCurrency.toUpperCase() === defaultCurrency.toUpperCase() ? { baseCurrency: defaultCurrency.toUpperCase(), rates: {} } : null;
}

// Returns the coupon and its definition in the cart currency, or throws CouponNotRedeemableError.
// The subtotal goes back to base with the same rate the apply path uses, so both agree.
export async function assertRedeemableInCartCurrency(
  deps: CouponRedemptionDeps,
  code: string,
  subtotalMinor: number,
  currencyCode: string,
  now: Date,
): Promise<{ definition: CouponDefinition; coupon: CouponRecord }> {
  const rates = await deps.rates(currencyCode);
  const baseSubtotal = toBaseSubtotal(subtotalMinor, currencyCode, rates);
  // Without a rate the minimum cannot be compared; skip it here and let toCartCurrency reject
  // every coupon that has one (or is fixed).
  const result = await deps.evaluate(code, baseSubtotal ?? Number.MAX_SAFE_INTEGER, now);
  if (!result.valid || !result.coupon) {
    const message = result.error ?? 'Coupon is not redeemable';
    const minOrder = result.coupon && MIN_ORDER_FAILURE.test(message) ? minimumInCartCurrency(result.coupon, baseSubtotal, currencyCode, rates) : null;
    throw minOrder ? new CouponMinimumNotMetError(message, minOrder) : new CouponNotRedeemableError(message);
  }
  try {
    return { definition: toCartCurrency(toCouponDefinition(result.coupon), currencyCode, rates), coupon: result.coupon };
  } catch (err) {
    if (err instanceof CouponCurrencyUnsupportedError) throw new CouponNotRedeemableError(err.message);
    throw err;
  }
}

export type CouponPreview =
  | { valid: true; discountMinor: number; definition: CouponDefinition; coupon: CouponRecord }
  | { valid: false; error: string; minOrder?: CouponMinimum };

// Storefront preview: same conversion and discount math as the session apply.
export async function previewCoupon(
  deps: CouponRedemptionDeps,
  code: string,
  subtotalMinor: number,
  currencyCode: string,
  now: Date,
): Promise<CouponPreview> {
  try {
    const { definition, coupon } = await assertRedeemableInCartCurrency(deps, code, subtotalMinor, currencyCode, now);
    const applied = new CouponEvaluationService().evaluate(definition, Money.of(subtotalMinor, currencyCode.toUpperCase()));
    return { valid: true, discountMinor: applied.discount.amountMinor, definition, coupon };
  } catch (err) {
    if (err instanceof CouponMinimumNotMetError || err instanceof SubtotalBelowMinimumError) {
      return { valid: false, error: err.message, minOrder: err.minOrder };
    }
    if (err instanceof CouponNotRedeemableError) return { valid: false, error: err.message };
    throw err;
  }
}
