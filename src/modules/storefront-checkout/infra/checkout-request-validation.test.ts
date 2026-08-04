import { describe, it, expect } from 'vitest';
import { validateCheckoutRequest } from './checkout-request-validation';

const VARIANT = 'gid://shopify/ProductVariant/47914156097689';

describe('validateCheckoutRequest', () => {
  it('accepts a well-formed cart line', () => {
    expect(validateCheckoutRequest('cart', { variantExternalId: VARIANT, quantity: 2 })).toBeNull();
  });

  it('accepts a cart line with no explicit quantity', () => {
    expect(validateCheckoutRequest('cart', { variantExternalId: VARIANT })).toBeNull();
  });

  // Regression: an unparseable body falls back to {}, so variantExternalId reached ExternalRef.of
  // and the shopper was shown "ExternalRef requires a non-empty token".
  it.each([{}, { variantExternalId: '' }, { variantExternalId: '   ' }, { variantExternalId: 42 }])(
    'rejects a cart line with a missing or blank variant ref: %j',
    (body) => {
      const result = validateCheckoutRequest('cart', body as Record<string, unknown>);
      expect(result?.error).toBe('invalid_request');
      expect(result?.message).toBe('Please choose a product before continuing.');
    },
  );

  it('bounds the variant ref so an oversized token never reaches the commerce backend', () => {
    const result = validateCheckoutRequest('cart', { variantExternalId: 'x'.repeat(257) });
    expect(result?.error).toBe('invalid_request');
  });

  it.each([0, -5, 1.5, 1000, 'two'])('rejects an out-of-range quantity: %j', (quantity) => {
    const result = validateCheckoutRequest('cart', { variantExternalId: VARIANT, quantity });
    expect(result?.message).toBe('Please enter a quantity between 1 and 999.');
  });

  it('applies the same line rules to one-click upsell', () => {
    expect(validateCheckoutRequest('upsell', { variantExternalId: '' })?.error).toBe('invalid_request');
    expect(validateCheckoutRequest('upsell', { variantExternalId: VARIANT, quantity: 1 })).toBeNull();
  });

  it('requires a bounded coupon code', () => {
    expect(validateCheckoutRequest('coupon', { code: 'GLOW10' })).toBeNull();
    expect(validateCheckoutRequest('coupon', {})?.message).toBe('Please enter a valid coupon code.');
    expect(validateCheckoutRequest('coupon', { code: 'x'.repeat(65) })?.error).toBe('invalid_request');
  });

  it('requires a bounded step slug on session start', () => {
    expect(validateCheckoutRequest('session', { stepSlug: 'checkout-wellness' })).toBeNull();
    expect(validateCheckoutRequest('session', {})?.error).toBe('invalid_request');
  });

  // submit carries a deferred buyer for PayPal express (no email/phone until capture),
  // so it must not be validated here.
  it.each(['submit', 'advance', 'bogus'])('leaves %s untouched', (action) => {
    expect(validateCheckoutRequest(action, {})).toBeNull();
  });
});
