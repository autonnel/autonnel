import React, { useEffect, useRef, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useTranslation } from '../../LanguageContext';
import { scaledFontSize } from '../../TextField';
import { getIframeFieldStyle, labelStyle } from './types';
import type { ShopPayPalPaymentInput } from '@/contracts/shop';

interface PayPalCardFormProps {
  borderColor: string;
  buttonColor: string;
  buttonText: string;
  onProcessingChange: (processing: boolean) => void;
}

type CardErrors = Record<string, string>;

const CARD_FIELD_IDS = {
  number: 'paypal-card-number',
  expiry: 'paypal-card-expiry',
  cvv: 'paypal-card-cvv',
} as const;

const PAYPAL_TIMEOUT_MS = 30000;
const REQUIRED_CHECKOUT_FIELDS = [
  ['email', 'Email'],
  ['firstName', 'First Name'],
  ['lastName', 'Last Name'],
  ['phone', 'Phone'],
  ['address1', 'Address'],
  ['city', 'City'],
  ['postalCode', 'Postal Code'],
] as const;

function rawPayPalError(error: any) {
  try {
    const payload = JSON.stringify(error, Object.getOwnPropertyNames(error));
    if (payload && payload !== '{}') return payload.slice(0, 500);
  } catch {

  }
  return String(error).slice(0, 500);
}

function track(eventName: string, payload: Record<string, unknown>) {
  (window as any).Autonnel?.trackEvent?.(eventName, payload);
}

function paypalErrorCode(error: any): string | null {
  if (!error || typeof error !== 'object') return null;
  return error.name || error.code || error.type || null;
}

function savePaymentError(detailedError: string, code?: string | null) {
  const orderId = (window as any).__CHECKOUT_STATE__?.currentOrderId;
  if (orderId) {
    const saveErrorBody: ShopPayPalPaymentInput = {
      action: 'save-error',
      orderId,
      trackingId: (window as any).Autonnel?.trackingId,
      error: detailedError,
    };
    fetch('/api/shop/payment/paypal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saveErrorBody),
    }).catch(() => {});
  }

  window.dispatchEvent(new CustomEvent('autonnel:showPaymentError', {
    detail: { message: 'Payment failed. Please try again.', provider: 'paypal', code: code ?? null },
  }));
  track('PAYPAL_ERROR', { orderId, code: code ?? null });
}

function createPaypalCardOrder() {
  return new Promise((resolve, reject) => {
    const handler = (event: CustomEvent) => {
      window.removeEventListener('autonnel:paypalOrderCreated', handler as EventListener);
      clearTimeout(timeout);
      if (event.detail?.orderId) {
        resolve(event.detail.orderId);
      } else {
        reject(new Error(event.detail?.error || 'Failed to create order'));
      }
    };

    window.addEventListener('autonnel:paypalOrderCreated', handler as EventListener);
    window.dispatchEvent(new CustomEvent('autonnel:paypalCreateOrder', { detail: { type: 'paypal-card' } }));

    const timeout = setTimeout(() => {
      window.removeEventListener('autonnel:paypalOrderCreated', handler as EventListener);
      reject(new Error('Order creation timeout'));
    }, PAYPAL_TIMEOUT_MS);
  });
}

function getInputValue(name: string) {
  const element = document.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | null;
  return element ? (element.value || '').trim() : '';
}

function collectCheckoutData() {
  const email = getInputValue('email');
  const firstName = getInputValue('firstName');
  const lastName = getInputValue('lastName');
  if (!email || !firstName || !lastName) return;

  window.dispatchEvent(new CustomEvent('autonnel:checkoutSubmit', {
    detail: {
      email,
      firstName,
      lastName,
      phone: getInputValue('phone'),
      address1: getInputValue('address1'),
      address2: getInputValue('address2'),
      city: getInputValue('city'),
      state: getInputValue('state'),
      postalCode: getInputValue('postalCode'),
      country: getInputValue('country') || 'US',
    },
  }));
}

function missingCheckoutLabels() {
  return REQUIRED_CHECKOUT_FIELDS
    .filter(([name]) => !getInputValue(name))
    .map(([, label]) => label);
}

function sdkInputStyle() {
  return {
    input: {
      'font-size': '15px',
      'font-family': 'Arial, Helvetica, sans-serif',
      color: '#111827',
      padding: '0 16px',
      height: '46px',
    },
    '.invalid': { color: '#ef4444' },
  };
}

function CardField({
  id,
  label,
  ready,
  retrying,
  error,
  borderColor,
}: {
  id: string;
  label: string;
  ready: boolean;
  retrying?: boolean;
  error?: string;
  borderColor: string;
}) {
  const t = useTranslation();
  const fieldStyle = getIframeFieldStyle(borderColor);

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div id={id} style={{ ...fieldStyle, height: '56px', border: 'none', borderRadius: 0, position: 'relative' }}>
        {!ready && id === CARD_FIELD_IDS.number && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 16px', color: '#9ca3af', fontSize: scaledFontSize(15) }}>
            {retrying ? t('paypalCard.retrying') : t('paypalCard.loadingPayment')}
          </div>
        )}
      </div>
      {error && <p style={{ color: '#ef4444', fontSize: scaledFontSize(13), marginTop: 4 }}>{error}</p>}
    </div>
  );
}

function BrandStrip() {
  const t = useTranslation();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '12px 16px', background: '#f9fafb', borderRadius: 8 }}>
      <span style={{ fontSize: scaledFontSize(12), color: '#6b7280' }}>{t('paypalCard.poweredBy')}</span>
      <strong style={{ color: '#253B80', fontSize: scaledFontSize(18), letterSpacing: '0.2px' }}>PayPal</strong>
      <span style={{ marginLeft: 'auto', fontSize: scaledFontSize(12), color: '#6b7280' }}>{t('paypalCard.secureCheckout')}</span>
    </div>
  );
}

function GeneralError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 16 }}>
      <p style={{ color: '#dc2626', fontSize: scaledFontSize(14) }}>{message}</p>
    </div>
  );
}

function SubmitButton({
  processing,
  color,
  text,
  onClick,
}: {
  processing: boolean;
  color: string;
  text: string;
  onClick: () => void;
}) {
  const t = useTranslation();
  return (
    <button
      type="submit"
      disabled={processing}
      onClick={onClick}
      style={{ width: '100%', padding: '16px 24px', background: processing ? '#9ca3af' : color, color: 'white', border: 'none', borderRadius: 10, fontSize: scaledFontSize(16), fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'all 0.2s' }}
    >
      {processing ? (
        <>
          <span style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          {t('paypalCard.processing')}
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4" />
          {text}
        </>
      )}
    </button>
  );
}

export function PayPalCardForm({
  borderColor,
  buttonColor,
  buttonText,
  onProcessingChange,
}: PayPalCardFormProps) {
  const t = useTranslation();
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<CardErrors>({});
  const [processing, setProcessing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [sdkVersion, setSdkVersion] = useState(0);
  const cardFieldsRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const resetForReload = () => {
      console.log('[PayPalCardForm] SDK reloading for currency change, resetting...');
      initializedRef.current = false;
      cardFieldsRef.current = null;
      setReady(false);
      setErrors({});
    };
    const bumpVersion = () => setSdkVersion((version) => version + 1);

    window.addEventListener('autonnel:paypalSdkReloading', resetForReload);
    window.addEventListener('paypal-sdk-ready', bumpVersion);
    return () => {
      window.removeEventListener('autonnel:paypalSdkReloading', resetForReload);
      window.removeEventListener('paypal-sdk-ready', bumpVersion);
    };
  }, []);

  useEffect(() => {
    onProcessingChange(processing);
    window.dispatchEvent(new CustomEvent('autonnel:paymentProcessing', { detail: { active: processing } }));
  }, [processing, onProcessingChange]);

  useEffect(() => {
    if (initializedRef.current) return;

    const initialize = async () => {
      if (!window.paypal?.CardFields) {
        console.log('[PayPalCardForm] CardFields not available');
        return;
      }

      try {
        initializedRef.current = true;
        const cardFields = window.paypal.CardFields({
          style: sdkInputStyle(),
          createOrder: createPaypalCardOrder,
          onApprove: async (data: any) => {
            window.dispatchEvent(new CustomEvent('autonnel:paypalApproved', {
              detail: { orderId: data.orderID, payerId: data.payerID, type: 'paypal-card' },
            }));
          },
          onError: (error: any) => {
            if (error?.message === '__CURRENCY_RELOAD__') return;
            if (!mountedRef.current) {
              console.log('[PayPalCardForm] Ignoring error after unmount:', error?.message || error);
              return;
            }
            console.error('[PayPalCardForm] Error:', error);
            setErrors({ general: 'Payment failed. Please try again.' });
            setProcessing(false);
            savePaymentError(rawPayPalError(error), paypalErrorCode(error));
          },
        });

        if (!cardFields.isEligible()) {
          console.log('[PayPalCardForm] Not eligible');
          setErrors({ general: t('paypalCard.notAvailable') });
          return;
        }

        await cardFields.NumberField().render(`#${CARD_FIELD_IDS.number}`);
        await cardFields.ExpiryField().render(`#${CARD_FIELD_IDS.expiry}`);
        await cardFields.CVVField().render(`#${CARD_FIELD_IDS.cvv}`);
        cardFieldsRef.current = cardFields;
        setReady(true);
        console.log('[PayPalCardForm] Initialized');
      } catch (error) {
        console.error('[PayPalCardForm] Init failed:', error);
        setErrors({ general: t('paypalCard.loadFailed') });
      }
    };

    if ((window as any).__PAYPAL_SDK_READY__ || window.paypal?.CardFields) {
      initialize();
      return;
    }

    const handleSdkReady = () => {
      setRetrying(false);
      initialize();
    };
    const handleSdkStatus = (event: CustomEvent) => {
      const { status } = event.detail;
      if (status === 'retrying') setRetrying(true);
      if (status === 'failed') {
        setRetrying(false);
        setErrors({ general: t('paypalCard.refreshPage') });
        track('PAYMENT_ERROR', { error: 'PayPal Card Fields SDK failed to load', paymentType: 'paypal-card' });
      }
    };

    window.addEventListener('paypal-sdk-ready', handleSdkReady);
    window.addEventListener('paypal-sdk-status', handleSdkStatus as EventListener);

    const timeout = setTimeout(() => {
      if (!window.paypal?.CardFields && !initializedRef.current) {
        console.log('[PayPalCardForm] SDK timeout');
        setRetrying(false);
        setErrors({ general: t('paypalCard.refreshPage') });
        track('PAYMENT_ERROR', { error: 'PayPal Card Fields SDK loading timeout', paymentType: 'paypal-card' });
      }
    }, PAYPAL_TIMEOUT_MS);

    return () => {
      window.removeEventListener('paypal-sdk-ready', handleSdkReady);
      window.removeEventListener('paypal-sdk-status', handleSdkStatus as EventListener);
      clearTimeout(timeout);
    };
  }, [sdkVersion, t]);

  const handleButtonClick = () => {
    if (processing) return;
    const state = (window as any).__CHECKOUT_STATE__;
    if (state?.customerInfo && state?.shippingAddress) return;

    const missing = missingCheckoutLabels();
    if (missing.length === 0) return;

    track('PAYPAL_CC_CLICK', { paymentType: 'paypal-card', hasAddress: false });
    track('FORM_VALIDATION_FAILED', {
      reason: `Missing required fields: ${missing.join(', ')}`,
      paymentType: 'paypal-card',
      missingFields: missing,
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!cardFieldsRef.current) {
      setErrors({ general: t('paypalCard.notReady') });
      track('PAYMENT_ERROR', { error: 'PayPal Card Fields SDK not ready', paymentType: 'paypal-card' });
      return;
    }

    collectCheckoutData();
    const checkoutState = (window as any).__CHECKOUT_STATE__;
    const email = checkoutState?.customerInfo?.email || '';

    if (!email || !checkoutState?.shippingAddress) {
      window.dispatchEvent(new CustomEvent('autonnel:formValidationError', { detail: {} }));
      setErrors({ general: 'Please fill in all required shipping fields.' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      window.dispatchEvent(new CustomEvent('autonnel:formValidationError', { detail: { invalidEmail: true } }));
      setErrors({ general: 'Please enter a valid email address.' });
      return;
    }

    setProcessing(true);
    setErrors({});

    try {
      await cardFieldsRef.current.submit();
    } catch (error: any) {
      console.error('[PayPalCardForm] Submit error:', error);
      setErrors({ general: 'Payment failed. Please try again.' });
      setProcessing(false);
      savePaymentError(rawPayPalError(error), paypalErrorCode(error));
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 16 }}>
        <CardField id={CARD_FIELD_IDS.number} label={t('paypalCard.cardNumberLabel')} ready={ready} retrying={retrying} error={errors.number} borderColor={borderColor} />
      </div>

      <div className="autonnel-form-grid-2" style={{ marginBottom: 16 }}>
        <CardField id={CARD_FIELD_IDS.expiry} label={t('paypalCard.expirationLabel')} ready={ready} error={errors.expiry} borderColor={borderColor} />
        <CardField id={CARD_FIELD_IDS.cvv} label={t('paypalCard.cvvLabel')} ready={ready} error={errors.cvv} borderColor={borderColor} />
      </div>

      <BrandStrip />
      <GeneralError message={errors.general} />
      <SubmitButton processing={processing} color={buttonColor} text={buttonText} onClick={handleButtonClick} />
    </form>
  );
}

export default PayPalCardForm;
