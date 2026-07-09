import React, { useEffect, useRef, useState } from 'react';
import { scaledFontSize } from '../../TextField';

interface PayPalButtonProps {
  onProcessingChange: (processing: boolean) => void;
}

const REQUIRED_FIELDS = [
  ['email', 'Email'],
  ['firstName', 'First Name'],
  ['lastName', 'Last Name'],
  ['phone', 'Phone'],
  ['address1', 'Address'],
  ['city', 'City'],
  ['postalCode', 'Postal Code'],
] as const;

const PO_BOX_REGEX = /(?:^|\s|,)(?:p\.?\s*o\.?\s*box|p\.?\s*o\.?\s*b\.?(?:\s|$|[0-9#])|post\s+office\s+box)\b/i;
const PAYPAL_LOAD_TIMEOUT_MS = 30000;

function formField(name: string) {
  return document.querySelector(`[name="${name}"]`) as HTMLInputElement | null;
}

function checkoutMissingFields() {
  return REQUIRED_FIELDS
    .filter(([name]) => !formField(name)?.value.trim())
    .map(([, label]) => label);
}

function resetFieldHighlight(name: string, invalid: boolean) {
  const element = formField(name);
  if (!element) return null;

  element.style.borderColor = invalid ? '#dc2626' : '';
  element.style.boxShadow = invalid ? '0 0 0 1px #dc2626' : '';
  return element;
}

function focusFirstMissingField() {
  let firstInvalid: HTMLElement | null = null;
  for (const [name] of REQUIRED_FIELDS) {
    const invalid = !formField(name)?.value.trim();
    const element = resetFieldHighlight(name, invalid);
    if (invalid && !firstInvalid) firstInvalid = element;
  }
  firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  firstInvalid?.focus();
}

function hasPOBoxAddress() {
  return PO_BOX_REGEX.test(formField('address1')?.value?.trim() || '')
    || PO_BOX_REGEX.test(formField('address2')?.value?.trim() || '');
}

function track(eventName: string, payload: Record<string, unknown>) {
  (window as any).Autonnel?.trackEvent?.(eventName, payload);
}

function createPayPalOrderPromise() {
  return new Promise((resolve, reject) => {
    const handler = (event: CustomEvent) => {
      window.removeEventListener('autonnel:paypalOrderCreated', handler as EventListener);
      clearTimeout(timeoutId);
      if (event.detail?.orderId) {
        resolve(event.detail.orderId);
      } else {
        reject(new Error(event.detail?.error || 'Failed to create order'));
      }
    };

    window.addEventListener('autonnel:paypalOrderCreated', handler as EventListener);
    const timeoutId = setTimeout(() => {
      window.removeEventListener('autonnel:paypalOrderCreated', handler as EventListener);
      reject(new Error('Timeout creating order'));
    }, PAYPAL_LOAD_TIMEOUT_MS);

    window.dispatchEvent(new CustomEvent('autonnel:paypalCreateOrder', { detail: { type: 'form' } }));
  });
}

function PayPalNotice({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div style={{ padding: compact ? '10px 14px' : '12px 16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: 12 }}>
      <p style={{ color: '#dc2626', fontSize: scaledFontSize(compact ? 13 : 13), textAlign: 'center', margin: 0 }}>{children}</p>
    </div>
  );
}

function LoadingButton({ retrying }: { retrying: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 45, background: '#FFC439', borderRadius: 25, color: '#003087', fontSize: scaledFontSize(14) }}>
      <span style={{ width: 16, height: 16, border: '2px solid #003087', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 8 }} />
      {retrying ? 'Retrying PayPal...' : 'Loading PayPal...'}
    </div>
  );
}

function SecureFooter() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
      <span style={{ fontSize: scaledFontSize(12), color: '#9ca3af' }}>🔒 Secure payment</span>
      <span style={{ fontSize: scaledFontSize(12), color: '#9ca3af' }}>•</span>
      <span style={{ fontSize: scaledFontSize(12), color: '#9ca3af' }}>Buyer protection included</span>
    </div>
  );
}

export function PayPalButton({ onProcessingChange: _onProcessingChange }: PayPalButtonProps) {
  const [ready, setReady] = useState(false);
  const [buttonError, setButtonError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const resetForCurrencyReload = () => {
      console.log('[PayPalButton] SDK reloading for currency change, resetting...');
      initializedRef.current = false;
      setReady(false);
      setButtonError(null);
      if (containerRef.current) containerRef.current.innerHTML = '';
    };

    window.addEventListener('autonnel:paypalSdkReloading', resetForCurrencyReload);
    return () => window.removeEventListener('autonnel:paypalSdkReloading', resetForCurrencyReload);
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;

    const init = () => {
      if (!window.paypal?.Buttons || !containerRef.current) return false;

      if (containerRef.current.childElementCount > 0) {
        setReady(true);
        return true;
      }

      try {
        initializedRef.current = true;
        window.paypal.Buttons({
          fundingSource: window.paypal.FUNDING.PAYPAL,
          style: { color: 'gold', shape: 'pill', label: 'paypal', height: 45 },
          onClick: (_data: any, actions: any) => {
            const missingFields = checkoutMissingFields();
            if (missingFields.length > 0) {
              focusFirstMissingField();
              setValidationError(`Please fill in: ${missingFields.join(', ')}`);
              track('PAYPAL_BUTTON_CLICK', { paymentType: 'paypal', hasAddress: false, validationFailed: true });
              track('FORM_VALIDATION_FAILED', {
                reason: `Missing required fields: ${missingFields.join(', ')}`,
                paymentType: 'paypal',
                missingFields,
              });
              return actions.reject();
            }

            if (hasPOBoxAddress()) {
              setValidationError('PO Box addresses are not accepted. Please enter a street address.');
              resetFieldHighlight('address1', true)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              formField('address1')?.focus();
              track('FORM_VALIDATION_FAILED', {
                reason: 'PO Box address not allowed',
                paymentType: 'paypal',
                missingFields: ['address1'],
              });
              return actions.reject();
            }

            setValidationError(null);
            return actions.resolve();
          },
          createOrder: createPayPalOrderPromise,
          onApprove: async (data: any) => {
            window.dispatchEvent(new CustomEvent('autonnel:paypalApproved', {
              detail: { orderId: data.orderID, payerId: data.payerID },
            }));
          },
          onError: (error: any) => {
            if (error?.message === '__CURRENCY_RELOAD__') return;
            console.error('[PayPalButton] Error:', error);
            setButtonError('PayPal checkout failed. Please try again.');
            track('PAYPAL_ERROR', { error: error?.message || 'PayPal checkout failed' });
          },
          onCancel: () => {
            window.dispatchEvent(new CustomEvent('autonnel:paypalCancelled'));
          },
        }).render(containerRef.current);

        setReady(true);
        console.log('[PayPalButton] Initialized');
        return true;
      } catch (error) {
        console.error('[PayPalButton] Render failed:', error);
        setButtonError('Failed to load PayPal. Please try again.');
        return false;
      }
    };

    if ((window as any).__PAYPAL_SDK_READY__ || window.paypal?.Buttons) {
      if (init()) return;
    }

    const handleSdkReady = () => {
      setRetrying(false);
      init();
    };
    const handleSdkStatus = (event: CustomEvent) => {
      const { status } = event.detail;
      if (status === 'retrying') setRetrying(true);
      if (status === 'failed') {
        setRetrying(false);
        setButtonError('PayPal failed to load. Please refresh the page.');
        track('PAYMENT_ERROR', { error: 'PayPal SDK failed to load', paymentType: 'paypal' });
      }
    };

    window.addEventListener('paypal-sdk-ready', handleSdkReady);
    window.addEventListener('paypal-sdk-status', handleSdkStatus as EventListener);

    const timeout = setTimeout(() => {
      if (!ready && !initializedRef.current) {
        console.log('[PayPalButton] SDK timeout');
        setRetrying(false);
        setButtonError('PayPal failed to load. Please refresh the page.');
        track('PAYMENT_ERROR', { error: 'PayPal SDK loading timeout', paymentType: 'paypal' });
      }
    }, PAYPAL_LOAD_TIMEOUT_MS);

    return () => {
      window.removeEventListener('paypal-sdk-ready', handleSdkReady);
      window.removeEventListener('paypal-sdk-status', handleSdkStatus as EventListener);
      clearTimeout(timeout);
    };
  }, [ready]);

  return (
    <div style={{ padding: 24, background: '#f9fafb', borderRadius: 10, marginBottom: 24 }}>
      <p style={{ fontSize: scaledFontSize(14), color: '#6b7280', marginBottom: 16, textAlign: 'center' }}>
        Click the PayPal button below to complete your payment securely.
      </p>
      {validationError && <PayPalNotice compact>{validationError}</PayPalNotice>}
      <div ref={containerRef} style={{ minHeight: 45, marginBottom: 12 }}>
        {!ready && !buttonError && <LoadingButton retrying={retrying} />}
      </div>
      {buttonError && <PayPalNotice>{buttonError}</PayPalNotice>}
      <SecureFooter />
    </div>
  );
}

export default PayPalButton;
