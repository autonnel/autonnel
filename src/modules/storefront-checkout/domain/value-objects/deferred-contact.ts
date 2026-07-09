export const DEFERRED_CONTACT_EMAIL = 'deferred@express.invalid';

export function deferredAddress(countryCode: string) {
  return { line1: 'Pending', city: '', countryCode, postalCode: '' };
}

// A deferred buyer is the express placeholder created before PayPal returns the real payer.
export function isDeferredContactNormalized(normalized: string): boolean {
  return normalized === DEFERRED_CONTACT_EMAIL;
}
