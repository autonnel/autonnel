import type React from 'react';
import type { TitleIconType } from '../../SectionTitle';
import type { TextFieldValue } from '../../TextField';

export interface PaymentEntryFormProps {
  sectionTitle?: string | TextFieldValue;
  titleIcon?: TitleIconType;
  showPayPalOption?: boolean;
  buttonText?: string;
  buttonColor?: string;
  showSecurityBadges?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
}

export type PaymentMethodType = 'paypal' | 'paypal-card' | 'card';

export interface PaymentConfig {
  paypal?: {
    clientId?: string;
    merchantId?: string;
    enableCardFields?: boolean;
    currency?: string;
  };
  card?: {
    publishableKey?: string;
    currency?: string;
  };
  providers?: Record<string, Record<string, any>>;
}

declare global {
  interface Window {
    paypal?: any;
    Stripe?: any;
    __PAYMENT_CONFIG__?: PaymentConfig;
    __PAYPAL_CLIENT_ID__?: string;
    __PAYPAL_SDK_READY__?: boolean;
    __PAYPAL_SDK_CURRENCY__?: string | null;
    __STRIPE_SDK_READY__?: boolean;
    __GOOGLE_MAPS_API_KEY__?: string;
  }
}

const FIELD_BASE: React.CSSProperties = {
  width: '100%',
  borderRadius: 4,
  background: 'white',
  boxSizing: 'border-box',
};

export const getInputStyle = (borderColor: string): React.CSSProperties => ({
  ...FIELD_BASE,
  padding: '8px 10px',
  border: `1px solid ${borderColor}`,
  fontSize: 14,
  fontFamily: 'inherit',
  color: '#333333',
  outline: 'none',
  transition: 'border-color 0.2s',
});

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 'var(--autonnel-label-fw, 700)' as any,
  color: '#333333',
  marginBottom: 4,
};

export const getIframeFieldStyle = (borderColor: string): React.CSSProperties => ({
  ...FIELD_BASE,
  height: '36px',
  border: `1px solid ${borderColor}`,
  overflow: 'hidden',
});

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MONTHS = MONTH_NAMES.map((name, index) => {
  const value = String(index + 1).padStart(2, '0');
  return { value, label: `${value} - ${name}` };
});

export const getYears = (): number[] => {
  const start = new Date().getFullYear();
  return Array.from({ length: 15 }, (_, offset) => start + offset);
};
