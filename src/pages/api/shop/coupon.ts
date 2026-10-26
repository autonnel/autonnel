import { defineRoute, ApiError } from '@/lib/api/define-route';
import { CHECKOUT_SESSION_COOKIE, checkoutSessionCurrency, previewStorefrontCoupon } from '@/composition/storefront-runtime';

const MAJOR_TO_MINOR = 100;
const CURRENCY_CODE = /^[A-Za-z]{3}$/;

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

// subtotal arrives decimal-major in the cart currency; the discount is returned decimal-major.
// The checkout session's currency wins over the page-supplied one ('' = store default).
export const GET = defineRoute('GET /api/shop/coupon', {}, async ({ query, request, locals }) => {
  const code = query.get('code');
  const subtotalParam = query.get('subtotal');
  if (!code) throw new ApiError(400, 'Coupon code is required');
  if (!subtotalParam) throw new ApiError(400, 'Subtotal is required');

  const subtotal = parseFloat(subtotalParam);
  if (Number.isNaN(subtotal) || subtotal < 0) throw new ApiError(400, 'Invalid subtotal value');
  const pageCurrency = query.get('currency') || null;
  if (pageCurrency && !CURRENCY_CODE.test(pageCurrency)) throw new ApiError(400, 'Invalid currency');

  const sessionCurrency = await checkoutSessionCurrency(readCookie(request, CHECKOUT_SESSION_COOKIE), locals);
  const currency = sessionCurrency ?? pageCurrency?.toUpperCase() ?? null;

  const result = await previewStorefrontCoupon(code, Math.round(subtotal * MAJOR_TO_MINOR), currency);
  if (!result.valid) {
    const error = result.error || 'Invalid coupon';
    return result.minOrder ? { valid: false as const, error, minOrder: result.minOrder } : { valid: false as const, error };
  }

  const { definition, coupon } = result;
  return {
    valid: true as const,
    discount: result.discountMinor / MAJOR_TO_MINOR,
    discountType: coupon.discountType,
    discountValue: definition.kind === 'fixed' ? definition.value / MAJOR_TO_MINOR : definition.value,
    couponId: coupon.id ?? '',
    code: coupon.code,
  };
});
