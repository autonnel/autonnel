import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CreditCard } from 'lucide-react';
import type { PaymentEntryFormProps } from './payment/types';
import { PaymentMethodTabs } from './payment/PaymentMethodTabs';
import { PayPalButton } from './payment/PayPalButton';
import { PayPalCardForm } from './payment/PayPalCardForm';
import { StripeCardForm } from './payment/StripeCardForm';
import { SectionTitle, titleIconField } from '../SectionTitle';
import { createTextField, scaledFontSize } from '../TextField';
import { useTranslation } from '../LanguageContext';
import type { PaymentMethodType } from './payment/types';

export type { PaymentEntryFormProps } from './payment/types';

interface ConfigState {
  hasPayPal: boolean;
  hasPayPalCardFields: boolean;
  hasStripe: boolean;
}

interface RenderProps extends PaymentEntryFormProps {
  puck?: { isEditing?: boolean };
}

const METHOD_TRACKING_NAME: Record<PaymentMethodType, string> = {
  paypal: 'paypal',
  'paypal-card': 'paypal_cc',
  card: 'stripe',
};

export function PaymentEntryForm({
  sectionTitle = { text: 'Payment Information', color: '#1a1a1a', fontSize: 16 },
  titleIcon = 'checkmark',
  showPayPalOption = true,
  buttonText = 'Complete Order',
  buttonColor = '#3b82f6',
  showSecurityBadges = true,
  backgroundColor = '#ffffff',
  borderColor = '#e5e7eb',
  borderRadius = 12,
  padding = 24,
  puck,
}: RenderProps) {
  const t = useTranslation();
  const isEditorMode = !!puck?.isEditing;

  const [configLoading, setConfigLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('paypal');
  const [, setProcessing] = useState(false);
  const [configState, setConfigState] = useState<ConfigState>({
    hasPayPal: false,
    hasPayPalCardFields: false,
    hasStripe: false,
  });

  useEffect(() => {
    if (isEditorMode) {
      setConfigState({
        hasPayPal: showPayPalOption,
        hasPayPalCardFields: false,
        hasStripe: false,
      });
      setConfigLoading(false);
      return;
    }

    let interval: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const checkConfig = (): boolean => {
      const cfg = window.__PAYMENT_CONFIG__;
      const hasPayPal = !!(cfg?.paypal?.clientId || window.__PAYPAL_CLIENT_ID__);
      const hasPayPalCardFields = hasPayPal && !!cfg?.paypal?.enableCardFields;
      const hasStripe = !!(
        cfg?.providers?.card?.publishableKey || cfg?.card?.publishableKey
      );

      if (hasPayPal || hasPayPalCardFields || hasStripe) {
        if (hasStripe) {
          setPaymentMethod('card');
        } else if (hasPayPalCardFields) {
          setPaymentMethod('paypal-card');
        } else if (hasPayPal) {
          setPaymentMethod('paypal');
        }
        setConfigState({ hasPayPal, hasPayPalCardFields, hasStripe });
        setConfigLoading(false);
        return true;
      }
      return false;
    };

    if (!checkConfig()) {
      interval = setInterval(() => {
        if (checkConfig() && interval) {
          clearInterval(interval);
        }
      }, 100);
      timeout = setTimeout(() => {
        if (interval) clearInterval(interval);
        setConfigLoading(false);
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [isEditorMode, showPayPalOption]);

  const { hasPayPal, hasPayPalCardFields, hasStripe } = configState;
  const hasAnyPaymentMethod = hasPayPal || hasPayPalCardFields || hasStripe;

  const handleProcessingChange = useCallback((value: boolean) => {
    setProcessing(value);
  }, []);

  const lastTrackedMethod = useRef<PaymentMethodType | null>(null);
  const handleMethodChange = useCallback((method: PaymentMethodType) => {
    setPaymentMethod(method);
    if (isEditorMode || lastTrackedMethod.current === method) return;
    lastTrackedMethod.current = method;
    window.dispatchEvent(
      new CustomEvent('autonnel:paymentMethodSelected', {
        detail: { method: METHOD_TRACKING_NAME[method] },
      }),
    );
  }, [isEditorMode]);

  const showPayPalTab = hasPayPal && showPayPalOption;
  const showPayPalCardTab = hasPayPalCardFields;
  const showStripeTab = hasStripe;

  return (
    <div
      style={{ background: backgroundColor, borderRadius, padding }}
      className="autonnel-payment-form"
    >
      <SectionTitle title={sectionTitle ?? ''} titleIcon={titleIcon} />

      {configLoading && (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid #e5e7eb',
              borderTopColor: buttonColor,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ fontSize: scaledFontSize(14), color: '#6b7280' }}>
            {t('payment.loading')}
          </p>
        </div>
      )}

      {!configLoading && !hasAnyPaymentMethod && (
        <div
          style={{
            padding: 32,
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              margin: '0 auto 12px',
              borderRadius: '50%',
              background: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CreditCard size={20} color="#9ca3af" strokeWidth={1.75} />
          </div>
          <h4
            style={{
              fontSize: scaledFontSize(16),
              fontWeight: 600,
              color: '#374151',
              marginBottom: 8,
            }}
          >
            {t('payment.notConfiguredTitle')}
          </h4>
          <p style={{ fontSize: scaledFontSize(14), color: '#6b7280' }}>
            {t('payment.notConfiguredMessage')}
          </p>
        </div>
      )}

      {!configLoading && hasAnyPaymentMethod && (
        <>
          <PaymentMethodTabs
            paymentMethod={paymentMethod}
            onMethodChange={handleMethodChange}
            showPayPal={showPayPalTab}
            showPayPalCard={showPayPalCardTab}
            showCreditCard={showStripeTab}
            borderColor={borderColor}
          />

          {paymentMethod === 'paypal' && (
            <PayPalButton onProcessingChange={handleProcessingChange} />
          )}
          {paymentMethod === 'paypal-card' && (
            <PayPalCardForm
              borderColor={borderColor}
              buttonColor={buttonColor}
              buttonText={buttonText}
              onProcessingChange={handleProcessingChange}
            />
          )}
          {paymentMethod === 'card' && (
            <StripeCardForm
              borderColor={borderColor}
              buttonColor={buttonColor}
              buttonText={buttonText}
              onProcessingChange={handleProcessingChange}
            />
          )}

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

          {showSecurityBadges && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                marginTop: 20,
                paddingTop: 20,
                borderTop: `1px solid ${borderColor}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: scaledFontSize(18) }}>🔒</span>
                <span style={{ fontSize: scaledFontSize(12), color: '#6b7280' }}>
                  {t('payment.sslBadge')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: scaledFontSize(18) }}>✅</span>
                <span style={{ fontSize: scaledFontSize(12), color: '#6b7280' }}>
                  {t('payment.pciBadge')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: scaledFontSize(18) }}>🛡️</span>
                <span style={{ fontSize: scaledFontSize(12), color: '#6b7280' }}>
                  {t('payment.secureCheckout')}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


export const PaymentEntryFormConfig = {
  label: 'Payment Form',
  render: PaymentEntryForm,
  fields: {
    sectionTitle: createTextField({
      label: 'Section Title',
      defaultColor: '#1a1a1a',
      defaultFontSize: 16,
    }),
    titleIcon: titleIconField,
    showPayPalOption: {
      type: 'radio' as const,
      label: 'Show PayPal Option',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    buttonText: { type: 'text' as const, label: 'Button Text' },
    buttonColor: { type: 'text' as const, label: 'Button Color' },
    showSecurityBadges: {
      type: 'radio' as const,
      label: 'Show Security Badges',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    backgroundColor: { type: 'text' as const, label: 'Background Color' },
    borderColor: { type: 'text' as const, label: 'Border Color' },
    borderRadius: { type: 'number' as const, label: 'Border Radius', min: 0, max: 32 },
    padding: { type: 'number' as const, label: 'Padding', min: 0, max: 64 },
  },
  defaultProps: {
    sectionTitle: { text: 'Payment Information', color: '#1a1a1a', fontSize: 16 },
    titleIcon: 'checkmark' as const,
    showPayPalOption: true,
    buttonText: 'Complete Order',
    buttonColor: '#3b82f6',
    showSecurityBadges: true,
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 24,
  },
};

export default PaymentEntryForm;
