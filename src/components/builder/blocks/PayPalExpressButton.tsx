import React, { useState, useEffect, useRef } from 'react';
import { createTextField, type TextFieldValue, getTextContent, getTextStyle, scaledFontSize } from '../TextField';
import { useTranslation } from '../LanguageContext';

declare global {
  interface Window {
    paypal?: any;
    __PAYPAL_CLIENT_ID__?: string;
    __PAYPAL_SDK_READY__?: boolean;
  }
}

export interface PayPalExpressButtonProps {
  theme: 'badges' | 'cards';
  title?: string | TextFieldValue;
  subtitle?: string | TextFieldValue;
  buttonStyle?: 'gold' | 'blue' | 'silver' | 'white' | 'black';
  buttonSize?: 'small' | 'medium' | 'large';
  showDivider?: boolean;
  dividerText?: string | TextFieldValue;
  backgroundColor?: string;
  borderRadius?: number;
  padding?: number;
}

const SPIN_KEYFRAMES = '@keyframes spin { to { transform: rotate(360deg); } }';

function buttonHeightFor(size: 'small' | 'medium' | 'large'): number {
  if (size === 'small') return 35;
  if (size === 'medium') return 40;
  return 45;
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        border: '2px solid #003087',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        marginRight: 8,
        display: 'inline-block',
      }}
    />
  );
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {icon}
      {label}
    </span>
  );
}

const lockIcon = (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const shieldIcon = (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export function PayPalExpressButton(props: PayPalExpressButtonProps) {
  const {
    theme = 'badges',
    title,
    subtitle,
    buttonStyle = 'gold',
    buttonSize = 'large',
    showDivider = true,
    dividerText,
    backgroundColor = '#f8fafc',
    borderRadius = 12,
    padding = 24,
  } = props;

  const t = useTranslation();

  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [notConfigured, setNotConfigured] = useState(
    () => (typeof window === 'undefined' ? false : !window.__PAYPAL_CLIENT_ID__)
  );

  const paypalButtonRef = useRef<HTMLDivElement>(null);

  // Storefront reloads the SDK (e.g. on currency change) by firing this event;
  // reset, then wait for exactly one follow-up 'paypal-sdk-ready'.
  useEffect(() => {
    const onReloading = () => {
      setSdkReady(false);
      setError(null);
      if (paypalButtonRef.current) paypalButtonRef.current.innerHTML = '';
      const onReady = () => {
        window.removeEventListener('paypal-sdk-ready', onReady);
        if (window.paypal) setSdkReady(true);
      };
      window.addEventListener('paypal-sdk-ready', onReady);
    };
    window.addEventListener('autonnel:paypalSdkReloading', onReloading);
    return () => window.removeEventListener('autonnel:paypalSdkReloading', onReloading);
  }, []);

  useEffect(() => {
    const clientId = window.__PAYPAL_CLIENT_ID__;
    if (!clientId) {
      setNotConfigured(true);
      return;
    }

    const initSdk = () => {
      if (window.paypal) {
        setSdkReady(true);
        setRetrying(false);
        return true;
      }
      return false;
    };

    if (window.__PAYPAL_SDK_READY__ || window.paypal) {
      initSdk();
      return;
    }

    const onReady = () => {
      initSdk();
    };
    const onStatus = (e: any) => {
      const status = e?.detail?.status;
      if (status === 'retrying') {
        setRetrying(true);
      } else if (status === 'failed') {
        setRetrying(false);
        setError(t('expressCheckout.sdkFailed'));
        (window as any).Autonnel?.trackEvent?.('PAYMENT_ERROR', {
          error: 'PayPal Express SDK failed to load',
          paymentType: 'paypal-express',
        });
      }
    };

    window.addEventListener('paypal-sdk-ready', onReady);
    window.addEventListener('paypal-sdk-status', onStatus);

    const timeoutId = setTimeout(() => {
      if (!window.paypal) {
        setRetrying(false);
        setError(t('expressCheckout.sdkFailed'));
        (window as any).Autonnel?.trackEvent?.('PAYMENT_ERROR', {
          error: 'PayPal Express SDK loading timeout',
          paymentType: 'paypal-express',
        });
      }
    }, 30000);

    return () => {
      window.removeEventListener('paypal-sdk-ready', onReady);
      window.removeEventListener('paypal-sdk-status', onStatus);
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!sdkReady || !window.paypal) return;
    if (!paypalButtonRef.current || paypalButtonRef.current.childElementCount !== 0) return;

    const isBadges = theme === 'badges';

    // createOrder: the storefront replies to 'autonnel:paypalCreateOrder' synchronously,
    // so the response listener MUST be attached before dispatching the request.
    const createOrder = async () =>
      new Promise<string>((resolve, reject) => {
        const onCreated = (e: any) => {
          window.removeEventListener('autonnel:paypalOrderCreated', onCreated);
          clearTimeout(timer);
          if (e?.detail?.orderId) {
            resolve(e.detail.orderId);
          } else {
            reject(new Error(e?.detail?.error || 'Failed to create order'));
          }
        };
        const timer = setTimeout(() => {
          window.removeEventListener('autonnel:paypalOrderCreated', onCreated);
          reject(new Error('Timeout creating order'));
        }, 30000);
        window.addEventListener('autonnel:paypalOrderCreated', onCreated);
        window.dispatchEvent(new CustomEvent('autonnel:paypalCreateOrder', { detail: { type: 'express' } }));
      });

    const onApprove = async (data: any) => {
      window.dispatchEvent(
        new CustomEvent('autonnel:paypalApproved', {
          detail: { orderId: data.orderID, payerId: data.payerID },
        })
      );
    };

    const onError = (err: any) => {
      if (err?.message === '__CURRENCY_RELOAD__') return;
      console.error('PayPal error:', err);
      setError(t('expressCheckout.checkoutFailed'));
      (window as any).Autonnel?.trackEvent?.('PAYPAL_ERROR', {
        error: err?.message || 'PayPal express checkout failed',
      });
    };

    const onCancel = () => {
      window.dispatchEvent(new CustomEvent('autonnel:paypalCancelled'));
    };

    try {
      window.paypal
        .Buttons({
          fundingSource: window.paypal.FUNDING.PAYPAL,
          style: {
            color: buttonStyle,
            shape: isBadges ? 'pill' : 'rect',
            label: 'paypal',
            height: isBadges ? buttonHeightFor(buttonSize) : 50,
          },
          createOrder,
          onApprove,
          onError,
          onCancel,
        })
        .render(paypalButtonRef.current);
    } catch (err) {
      console.error('Failed to render PayPal button:', err);
    }
  }, [sdkReady, buttonStyle, buttonSize, theme]);

  const isNotConfigured = notConfigured || (typeof window !== 'undefined' && !window.__PAYPAL_CLIENT_ID__);
  if (isNotConfigured) return null;

  const loadingLabel = retrying ? t('expressCheckout.retryingPayPal') : t('expressCheckout.loadingPayPal');
  const showLoading = !sdkReady && !error;

  if (theme === 'cards') {
    const titleText = getTextContent(title);
    return (
      <div className="autonnel-paypal-express" style={{ background: backgroundColor, padding, textAlign: 'center' }}>
        {titleText && (
          <h3 style={{ ...getTextStyle(title, { color: '#1a1a1a', fontSize: 18 }), fontWeight: 600, marginBottom: 16 }}>
            {titleText}
          </h3>
        )}
        <div ref={paypalButtonRef} style={{ maxWidth: 400, margin: '0 auto', minHeight: 50 }}>
          {showLoading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 50,
                background: '#FFC439',
                borderRadius: 4,
                color: '#003087',
              }}
            >
              <Spinner />
              {loadingLabel}
            </div>
          )}
        </div>
        {error && <p style={{ color: '#dc2626', fontSize: scaledFontSize(13), marginTop: 8 }}>{error}</p>}
        {showDivider && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, maxWidth: 400, margin: '24px auto 0' }}>
            <div style={{ flex: 1, height: 1, background: '#d1d5db' }} />
            <span style={{ color: '#6b7280', fontSize: scaledFontSize(14), fontWeight: 500 }}>
              {t('expressCheckout.orPayWithCreditCard')}
            </span>
            <div style={{ flex: 1, height: 1, background: '#d1d5db' }} />
          </div>
        )}
        <img
          src="/images/cc-payments.svg"
          alt="Credit card payments"
          style={{ maxWidth: 300, display: 'block', margin: '16px auto 0' }}
        />
        <style>{SPIN_KEYFRAMES}</style>
      </div>
    );
  }

  const buttonHeight = buttonHeightFor(buttonSize);
  const titleText = getTextContent(title);
  const subtitleText = getTextContent(subtitle);

  return (
    <div className="autonnel-paypal-express" style={{ background: backgroundColor, borderRadius, padding }}>
      {titleText && (
        <h3
          style={{
            ...getTextStyle(title, { color: '#111827', fontSize: 16 }),
            fontWeight: 600,
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          {titleText}
        </h3>
      )}
      {subtitleText && (
        <p style={{ ...getTextStyle(subtitle, { color: '#6b7280', fontSize: 14 }), marginBottom: 16, textAlign: 'center' }}>
          {subtitleText}
        </p>
      )}
      <div ref={paypalButtonRef} style={{ minHeight: buttonHeight }}>
        {showLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: buttonHeight,
              background: '#FFC439',
              borderRadius: 25,
              color: '#003087',
              fontSize: scaledFontSize(14),
            }}
          >
            <Spinner />
            {loadingLabel}
          </div>
        )}
      </div>
      {error && (
        <div
          style={{
            marginTop: 12,
            padding: '12px 16px',
            background: 'rgba(245, 158, 11, 0.1)',
            borderRadius: 8,
            border: '1px solid rgba(245, 158, 11, 0.3)',
          }}
        >
          <p style={{ color: '#b45309', fontSize: scaledFontSize(13), textAlign: 'center' }}>{`⚠️ ${error}`}</p>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          marginTop: 16,
          fontSize: scaledFontSize(12),
          color: '#6b7280',
        }}
      >
        <TrustBadge icon={lockIcon} label="Secure" />
        <TrustBadge icon={shieldIcon} label="Buyer Protection" />
      </div>
      {showDivider && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 24 }}>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          <span style={{ ...getTextStyle(dividerText, { color: '#9ca3af', fontSize: 13 }), fontWeight: 500 }}>
            {getTextContent(dividerText)}
          </span>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>
      )}
      <style>{SPIN_KEYFRAMES}</style>
    </div>
  );
}

export const PayPalExpressButtonConfig = {
  label: 'PayPal Express',
  fields: {
    theme: {
      type: 'radio' as const,
      options: [
        { label: 'Badges (trust strip + pill button)', value: 'badges' as const },
        { label: 'Cards (CC icons + rect button)', value: 'cards' as const },
      ],
    },
    title: createTextField({ label: 'Title', defaultColor: '#111827', defaultFontSize: 16 }),
    subtitle: createTextField({ label: 'Subtitle (Badges)', defaultColor: '#6b7280', defaultFontSize: 14 }),
    buttonStyle: {
      type: 'select' as const,
      label: 'Button Color',
      options: [
        { label: 'Gold (Recommended)', value: 'gold' as const },
        { label: 'Blue', value: 'blue' as const },
        { label: 'Silver', value: 'silver' as const },
        { label: 'White', value: 'white' as const },
        { label: 'Black', value: 'black' as const },
      ],
    },
    buttonSize: {
      type: 'radio' as const,
      label: 'Button Size (Badges)',
      options: [
        { label: 'Small', value: 'small' as const },
        { label: 'Medium', value: 'medium' as const },
        { label: 'Large', value: 'large' as const },
      ],
    },
    showDivider: {
      type: 'radio' as const,
      label: 'Show Divider',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    dividerText: createTextField({ label: 'Divider Text', defaultColor: '#9ca3af', defaultFontSize: 13 }),
    backgroundColor: { type: 'text' as const, label: 'Background Color' },
    borderRadius: { type: 'number' as const, label: 'Border Radius (Badges)', min: 0, max: 32 },
    padding: { type: 'number' as const, label: 'Padding', min: 0, max: 64 },
  },
  defaultProps: {
    theme: 'badges' as const,
    title: { text: 'Express Checkout', color: '#111827', fontSize: 16 },
    subtitle: { text: 'Skip the form and checkout faster with PayPal', color: '#6b7280', fontSize: 14 },
    buttonStyle: 'gold' as const,
    buttonSize: 'large' as const,
    showDivider: true,
    dividerText: { text: 'or continue below', color: '#9ca3af', fontSize: 13 },
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 24,
  },
  render: PayPalExpressButton,
};

export default PayPalExpressButton;
