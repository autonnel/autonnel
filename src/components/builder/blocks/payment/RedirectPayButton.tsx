import React, { useEffect, useState } from 'react';
import { collectCheckoutBuyer } from './checkout-buyer-form';
import { useLanguage, useTranslation } from '../../LanguageContext';
import { scaledFontSize } from '../../TextField';
import { translateCheckoutMessage } from '../../checkout-messages';

interface Props {
  provider: string;
  buttonColor: string;
  buttonText: string;
  onProcessingChange: (processing: boolean) => void;
}

function isAbsoluteHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

export function RedirectPayButton({ provider, buttonColor, buttonText, onProcessingChange }: Props) {
  const t = useTranslation();
  const lang = useLanguage();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('payment_error') === '1') {
      setError(t('payment.notCompletedOrOtherCard'));
      url.searchParams.delete('payment_error');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  useEffect(() => {
    onProcessingChange(processing);
    window.dispatchEvent(new CustomEvent('autonnel:paymentProcessing', { detail: { active: processing } }));
  }, [processing, onProcessingChange]);

  const handleClick = async () => {
    if (processing) return;
    const collected = collectCheckoutBuyer(lang);
    if (!collected.ok) {
      window.dispatchEvent(new CustomEvent('autonnel:formValidationError', { detail: collected.missing.length ? {} : { invalidEmail: true } }));
      setError(collected.error);
      return;
    }
    setError(null);
    setProcessing(true);
    window.dispatchEvent(new CustomEvent('autonnel:paymentButtonClick', { detail: { provider: provider.toLowerCase() } }));
    // The orchestrator reports why the order could not start (e.g. unsupported currency) as an event.
    let dispatched: string | null = null;
    const onPaymentError = (event: Event) => {
      const message = (event as CustomEvent).detail?.message;
      if (typeof message === 'string' && message.trim()) dispatched = message;
    };
    window.addEventListener('autonnel:showPaymentError', onPaymentError);
    let ensured;
    try {
      ensured = await window.Autonnel?.checkout?.ensureOrder?.(collected.buyer, provider);
    } catch {
      ensured = null;
    } finally {
      window.removeEventListener('autonnel:showPaymentError', onPaymentError);
    }
    if (!isAbsoluteHttpUrl(ensured?.clientHandle)) {
      setProcessing(false);
      setError(translateCheckoutMessage(lang, dispatched, 'payment.couldNotStart'));
      return;
    }
    window.location.href = ensured.clientHandle;
  };

  return (
    <div>
      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 16 }}>
          <p style={{ color: '#dc2626', fontSize: scaledFontSize(14) }}>{error}</p>
        </div>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={processing}
        style={{
          width: '100%', padding: '16px 24px', background: processing ? '#9ca3af' : buttonColor, color: 'white',
          border: 'none', borderRadius: 10, fontSize: scaledFontSize(16), fontWeight: 600,
          cursor: processing ? 'not-allowed' : 'pointer',
        }}
      >
        {processing ? t('paypalCard.processing') : `🔒 ${buttonText}`}
      </button>
    </div>
  );
}

export default RedirectPayButton;
