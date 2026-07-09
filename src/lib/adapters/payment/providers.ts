import { registerPaymentProvider, type PaymentProviderRegistration, type StatsColumnDef } from './registry';
import { readEnv } from '@/lib/runtime/env';

type StatRow = [StatsColumnDef['category'], string, string, string, string];

function statColumns(rows: StatRow[]): StatsColumnDef[] {
  return rows.map(([category, eventType, key, label, title]) => ({
    key,
    label,
    title,
    eventType,
    category,
  }));
}

function pickString(bag: Record<string, any>, name: string, fallback = ''): string {
  const raw = bag[name];
  return typeof raw === 'string' && raw ? raw : fallback;
}

const paypal: PaymentProviderRegistration = {
  paymentMethod: 'paypal',
  dbProvider: 'PAYPAL',

  eventTypes: {
    clickEvents: ['PAYPAL_EXPRESS_CLICK', 'PAYPAL_BUTTON_CLICK', 'PAYPAL_CC_CLICK'],
    successEvents: ['PAYPAL_PAYMENT', 'PAYPAL_CC_PAYMENT'],
    errorEvent: 'PAYPAL_ERROR',
  },

  display: {
    label: 'PayPal',
    badgeClass: 'bg-blue-100 text-blue-800 border-transparent',
  },

  displayName: 'PayPal Commerce Platform',

  formFields: [
    { key: 'clientId', label: 'Client ID', type: 'text' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Leave blank to keep' },
    {
      key: 'softDescriptor',
      label: 'Soft Descriptor',
      type: 'text',
      placeholder: 'e.g. MYBRAND.COM',
      hint: 'Shown on the cardholder’s statement. Max 22 chars; letters, digits, space, "-", ".", "*". Leave blank to auto-derive from your primary domain.',
    },
  ],

  details: {
    cc: { label: 'Credit Card', badgeClass: 'bg-sky-50 text-sky-700 border-transparent' },
    express: { label: 'Express', badgeClass: 'bg-amber-50 text-amber-700 border-transparent' },
    button: { label: 'Button', badgeClass: 'bg-gray-50 text-gray-600 border-transparent' },
  },

  statsColumns: statColumns([
    ['click', 'PAYPAL_BUTTON_CLICK', 'paypalButtonClick', 'PayPal', 'PayPal Button Click'],
    ['click', 'PAYPAL_EXPRESS_CLICK', 'paypalExpressClick', 'PP Express', 'PayPal Express Button Click'],
    ['click', 'PAYPAL_CC_CLICK', 'paypalCcClick', 'PP CC', 'PayPal Credit Card Click'],
    ['success', 'PAYPAL_PAYMENT', 'paypalPayment', 'PayPal', 'PayPal Payment Success'],
    ['success', 'PAYPAL_CC_PAYMENT', 'paypalCcPayment', 'PP CC', 'PayPal Credit Card Payment Success'],
    ['error', 'PAYPAL_ERROR', 'paypalError', 'PP Error', 'PayPal Payment Error'],
  ]),

  getPublicConfig(credentials, settings) {
    const fallbackClientId = readEnv('PAYPAL_APP_CLIENT_ID') || '';
    return {
      clientId: credentials.clientId || credentials.client_id || fallbackClientId,
      merchantId: credentials.merchantIdInPayPal || '',
      mode: credentials.mode || settings.mode || 'sandbox',
      currency: settings.currency || 'USD',
      enableCardFields: settings.enableCardFields || false,
    };
  },
};

const stripe: PaymentProviderRegistration = {
  paymentMethod: 'card',
  dbProvider: 'STRIPE',

  eventTypes: {
    clickEvents: ['STRIPE_SUBMIT'],
    successEvents: ['STRIPE_PAYMENT'],
    errorEvent: 'STRIPE_DECLINED',
  },

  display: {
    label: 'Credit Card',
    badgeClass: 'bg-blue-100 text-blue-800 border-transparent',
  },

  displayName: 'Stripe Payment Intents',

  formFields: [
    { key: 'publishableKey', label: 'Publishable Key', type: 'text', placeholder: 'pk_...' },
    { key: 'secretKey', label: 'Secret Key', type: 'password', placeholder: 'sk_... (leave blank to keep)' },
  ],

  details: {},

  statsColumns: statColumns([
    ['click', 'STRIPE_SUBMIT', 'stripeSubmit', 'Stripe', 'Stripe Card Submit'],
    ['success', 'STRIPE_PAYMENT', 'stripePayment', 'Stripe', 'Stripe Payment Success'],
    ['error', 'STRIPE_DECLINED', 'stripeDeclined', 'Stripe Err', 'Stripe Payment Declined'],
  ]),

  getPublicConfig(credentials, settings) {
    const publishableKey = pickString(credentials, 'publishableKey');
    if (!publishableKey) return null;
    return {
      publishableKey,
      currency: (settings.currency as string) || 'USD',
    };
  },
};

for (const registration of [paypal, stripe]) {
  registerPaymentProvider(registration);
}
