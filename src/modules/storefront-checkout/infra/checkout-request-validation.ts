// Unauthenticated shopper endpoint. Two reasons malformed input must be rejected here rather
// than deeper in the stack: domain invariant messages are surfaced to buyers verbatim (an empty
// variant id otherwise renders as "ExternalRef requires a non-empty token"), and free-form
// fields are forwarded to the commerce backend, so they need an upper bound before fan-out.
const MAX_REF_LENGTH = 256;
const MAX_CODE_LENGTH = 64;
const MAX_SLUG_LENGTH = 128;
const MAX_QUANTITY = 999;

export interface CheckoutRequestError {
  error: 'invalid_request';
  message: string;
}

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

function invalid(message: string): CheckoutRequestError {
  return { error: 'invalid_request', message };
}

function validateLine(body: Record<string, unknown>): CheckoutRequestError | null {
  if (!boundedString(body['variantExternalId'], MAX_REF_LENGTH)) {
    return invalid('Please choose a product before continuing.');
  }
  const quantity = body['quantity'];
  if (quantity === undefined || quantity === null) return null;
  if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > MAX_QUANTITY) {
    return invalid(`Please enter a quantity between 1 and ${MAX_QUANTITY}.`);
  }
  return null;
}

export function validateCheckoutRequest(
  action: string,
  body: Record<string, unknown>,
): CheckoutRequestError | null {
  switch (action) {
    case 'cart':
    case 'upsell':
      return validateLine(body);
    case 'coupon':
      return boundedString(body['code'], MAX_CODE_LENGTH) ? null : invalid('Please enter a valid coupon code.');
    case 'session':
      return boundedString(body['stepSlug'], MAX_SLUG_LENGTH)
        ? null
        : invalid('This checkout link is incomplete. Please start again from the product page.');
    default:
      return null;
  }
}
