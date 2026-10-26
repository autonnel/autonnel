import type { BuyerBody } from '@/scripts/checkout-buyer';
import { t } from '../../translations';
import type { PaymentConfig } from './types';

export type { BuyerBody };

export type CollectedBuyer =
  | { ok: true; buyer: BuyerBody & { email: string } }
  | { ok: false; error: string; missing: string[] };

export interface RedirectProviderOption {
  method: string;
  provider: string;
  label: string;
}

const REQUIRED_FIELDS = ['email', 'firstName', 'lastName', 'phone', 'address1', 'city', 'postalCode'];
const FIELD_LABELS = ['Email', 'First Name', 'Last Name', 'Phone', 'Address', 'City', 'Postal Code'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getFormValue(name: string): string {
  const el = document.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | null;
  return el ? (el.value || '').trim() : '';
}

export function autoCollectCheckoutData(): void {
  const email = getFormValue('email');
  const firstName = getFormValue('firstName');
  const lastName = getFormValue('lastName');
  if (!email || !firstName || !lastName) return;
  window.dispatchEvent(new CustomEvent('autonnel:checkoutSubmit', {
    detail: {
      email, firstName, lastName,
      phone: getFormValue('phone'),
      address1: getFormValue('address1'),
      address2: getFormValue('address2'),
      city: getFormValue('city'),
      state: getFormValue('state'),
      postalCode: getFormValue('postalCode'),
      country: getFormValue('country') || 'US',
    },
  }));
}

const invalidEmail = (lang: string): CollectedBuyer => ({ ok: false, error: t(lang, 'validation.invalidEmail'), missing: [] });

// State-first like the card form: the orchestrator's state wins when it already holds email and address.
export function collectCheckoutBuyer(lang: string = 'en'): CollectedBuyer {
  autoCollectCheckoutData();
  const state = (window as any).__CHECKOUT_STATE__;
  const stateEmail: string = state?.customerInfo?.email || '';

  if (stateEmail && state?.shippingAddress) {
    if (!EMAIL.test(stateEmail)) return invalidEmail(lang);
    const info = state.customerInfo;
    const addr = state.shippingAddress;
    return {
      ok: true,
      buyer: {
        fullName: `${info.firstName || ''} ${info.lastName || ''}`.trim() || undefined,
        email: stateEmail,
        phone: info.phone,
        address: {
          line1: addr.address1,
          line2: addr.address2,
          city: addr.city,
          region: addr.state,
          countryCode: addr.country || 'US',
          postalCode: addr.postalCode,
        },
      },
    };
  }

  const missing = REQUIRED_FIELDS.flatMap((name, i) => (getFormValue(name) ? [] : [FIELD_LABELS[i]!]));
  if (missing.length > 0) return { ok: false, error: t(lang, 'validation.fillShippingFields'), missing };
  const email = getFormValue('email');
  if (!EMAIL.test(email)) return invalidEmail(lang);
  return {
    ok: true,
    buyer: {
      fullName: `${getFormValue('firstName')} ${getFormValue('lastName')}`.trim(),
      email,
      phone: getFormValue('phone'),
      address: {
        line1: getFormValue('address1'),
        line2: getFormValue('address2') || undefined,
        city: getFormValue('city'),
        region: getFormValue('state') || undefined,
        countryCode: getFormValue('country') || 'US',
        postalCode: getFormValue('postalCode'),
      },
    },
  };
}

export function redirectProviders(cfg: PaymentConfig | undefined): RedirectProviderOption[] {
  return Object.entries(cfg?.providers ?? {}).flatMap(([method, value]) =>
    value && value.redirect === true && typeof value.provider === 'string'
      ? [{ method, provider: value.provider, label: typeof value.label === 'string' ? value.label : value.provider }]
      : [],
  );
}
