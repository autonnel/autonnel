import React, { useState, useEffect, useRef } from 'react';
import { labelStyle, getIframeFieldStyle } from './types';
import { useTranslation } from '../../LanguageContext';
import { scaledFontSize } from '../../TextField';
import type { ShopStripePaymentDto, ShopStripePaymentInput } from '@/contracts/shop';

interface StripeCardFormProps {
  borderColor: string;
  buttonColor: string;
  buttonText: string;
  onProcessingChange: (processing: boolean) => void;
}

const REQUIRED_FIELDS = ['email', 'firstName', 'lastName', 'phone', 'address1', 'city', 'postalCode'];
const FIELD_LABELS = ['Email', 'First Name', 'Last Name', 'Phone', 'Address', 'City', 'Postal Code'];

function getFormValue(name: string): string {
  const el = document.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | null;
  return el ? (el.value || '').trim() : '';
}

function emitPaymentError(message: string, code?: string | null) {
  window.dispatchEvent(new CustomEvent('autonnel:showPaymentError', {
    detail: { message, provider: 'stripe', code: code ?? null },
  }));
}

function autoCollectCheckoutData() {
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

export function StripeCardForm({
  borderColor,
  buttonColor,
  buttonText,
  onProcessingChange,
}: StripeCardFormProps) {
  const t = useTranslation();
  const [stripeReady, setStripeReady] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const cardElementRef = useRef<any>(null);
  const cardMountRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const iframeFieldStyle = getIframeFieldStyle(borderColor);

  useEffect(() => {
    onProcessingChange(processing);
    // Drive the global checkout processing overlay (shown until the thank-you redirect / cleared on error).
    window.dispatchEvent(new CustomEvent('autonnel:paymentProcessing', { detail: { active: processing } }));
  }, [processing, onProcessingChange]);

  useEffect(() => {
    if (initializedRef.current) return;

    const init = () => {
      if (!window.Stripe || !cardMountRef.current) return false;
      const config = window.__PAYMENT_CONFIG__?.providers?.card
        || window.__PAYMENT_CONFIG__?.card;
      const publishableKey = config?.publishableKey;
      if (!publishableKey) {
        setErrors({ general: 'Stripe is not configured.' });
        return false;
      }
      try {
        initializedRef.current = true;
        const stripe = window.Stripe(publishableKey);
        const elements = stripe.elements();
        const card = elements.create('card', {
          style: {
            base: {
              fontSize: '15px',
              fontFamily: 'Arial, Helvetica, sans-serif',
              color: '#111827',
              '::placeholder': { color: '#9ca3af' },
            },
            invalid: { color: '#ef4444' },
          },
        });
        card.mount(cardMountRef.current);
        card.on('change', (event: any) => {
          if (event.error) {
            setErrors((e) => ({ ...e, card: event.error.message }));
          } else {
            setErrors((e) => {
              const { card: _omit, ...rest } = e;
              return rest;
            });
          }
        });
        stripeRef.current = stripe;
        elementsRef.current = elements;
        cardElementRef.current = card;
        setStripeReady(true);
        return true;
      } catch (err) {
        console.error('[StripeCardForm] Init failed', err);
        setErrors({ general: 'Failed to initialize card form.' });
        return false;
      }
    };

    if (window.Stripe && window.__STRIPE_SDK_READY__) {
      if (init()) return;
    }

    const handleReady = () => { init(); };
    window.addEventListener('stripe-sdk-ready', handleReady);

    const timeout = setTimeout(() => {
      if (!stripeReady && !initializedRef.current) {
        if (!init()) {
          setErrors({ general: 'Card form failed to load. Please refresh the page.' });
        }
      }
    }, 15000);

    return () => {
      window.removeEventListener('stripe-sdk-ready', handleReady);
      clearTimeout(timeout);
      try { cardElementRef.current?.destroy?.(); } catch {  }
    };
  }, [stripeReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (processing) return;

    if (!stripeRef.current || !cardElementRef.current) {
      setErrors({ general: 'Card form not ready. Please wait.' });
      return;
    }

    autoCollectCheckoutData();

    const checkoutState = (window as any).__CHECKOUT_STATE__;
    const customerEmail = checkoutState?.customerInfo?.email || '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!customerEmail || !checkoutState?.shippingAddress) {
      const missing: string[] = [];
      REQUIRED_FIELDS.forEach((name, i) => {
        if (!getFormValue(name)) missing.push(FIELD_LABELS[i]);
      });
      window.dispatchEvent(new CustomEvent('autonnel:formValidationError', { detail: {} }));
      (window as any).Autonnel?.trackEvent?.('FORM_VALIDATION_FAILED', {
        reason: `Missing required fields: ${missing.join(', ')}`,
        paymentType: 'stripe-card',
        missingFields: missing,
      });
      setErrors({ general: 'Please fill in all required shipping fields.' });
      return;
    }
    if (!emailRegex.test(customerEmail)) {
      window.dispatchEvent(new CustomEvent('autonnel:formValidationError', {
        detail: { invalidEmail: true },
      }));
      setErrors({ general: 'Please enter a valid email address.' });
      return;
    }

    setProcessing(true);
    setErrors({});

    window.dispatchEvent(new CustomEvent('autonnel:paymentButtonClick', { detail: { provider: 'stripe' } }));
    (window as any).Autonnel?.trackEvent?.('STRIPE_SUBMIT', {
      paymentType: 'stripe-card',
    });

    try {
      const buyerFromForm = {
        fullName: `${checkoutState.customerInfo?.firstName || ''} ${checkoutState.customerInfo?.lastName || ''}`.trim() || undefined,
        email: customerEmail,
        phone: checkoutState.customerInfo?.phone,
        address: checkoutState.shippingAddress
          ? {
              line1: checkoutState.shippingAddress.address1,
              line2: checkoutState.shippingAddress.address2,
              city: checkoutState.shippingAddress.city,
              region: checkoutState.shippingAddress.state,
              countryCode: checkoutState.shippingAddress.country || 'US',
              postalCode: checkoutState.shippingAddress.postalCode,
            }
          : undefined,
      };
      const ensured = await window.Autonnel?.checkout?.ensureOrder?.(buyerFromForm);
      const orderId = ensured?.orderId || (window as any).__CHECKOUT_STATE__?.currentOrderId;
      if (!orderId) {
        // ensureOrder surfaces the real reason via autonnel:showPaymentError; don't call
        // the payment endpoint without an order (it would only report "orderId is required").
        setErrors({ general: 'Could not start your order — the item may be unavailable. Please refresh and try again.' });
        setProcessing(false);
        return;
      }

      const { paymentMethod, error: pmError } = await stripeRef.current.createPaymentMethod({
        type: 'card',
        card: cardElementRef.current,
        billing_details: {
          email: customerEmail,
          name: `${checkoutState.customerInfo?.firstName || ''} ${checkoutState.customerInfo?.lastName || ''}`.trim(),
          phone: checkoutState.customerInfo?.phone,
        },
      });

      if (pmError) {
        setErrors({ general: pmError.message || 'Card validation failed.' });
        setProcessing(false);
        emitPaymentError(pmError.message || 'Card validation failed.', pmError.decline_code || pmError.code);
        (window as any).Autonnel?.trackEvent?.('STRIPE_DECLINED', {
          error: pmError.message,
          code: pmError.code,
        });
        return;
      }

      const trackingId = (window as any).Autonnel?.trackingId;

      const win = window as unknown as { __AUTONNEL_FUNNEL_ID__?: string; __AUTONNEL_PAGE_ID__?: string };
      const confirmBody: ShopStripePaymentInput = {
        action: 'confirm',
        orderId,
        trackingId,
        paymentMethodId: paymentMethod.id,
        funnelId: win.__AUTONNEL_FUNNEL_ID__ ?? undefined,
        pageId: win.__AUTONNEL_PAGE_ID__,
      };
      const res = await fetch('/api/shop/payment/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmBody),
      });
      const data = (await res.json()) as ShopStripePaymentDto;

      if (!res.ok || !data.success) {
        const msg = data.error || 'Payment failed. Please try another card.';
        setErrors({ general: msg });
        setProcessing(false);
        emitPaymentError(msg, data.code);
        (window as any).Autonnel?.trackEvent?.('STRIPE_DECLINED', {
          error: msg,
          code: data.code,
        });
        return;
      }

      if (data.requiresAction && data.clientSecret) {
        const { error: confirmError, paymentIntent } = await stripeRef.current.handleCardAction(data.clientSecret);
        if (confirmError) {
          setErrors({ general: confirmError.message || '3DS authentication failed.' });
          setProcessing(false);
          emitPaymentError(confirmError.message || '3DS authentication failed.', confirmError.decline_code || confirmError.code);
          (window as any).Autonnel?.trackEvent?.('STRIPE_DECLINED', {
            error: confirmError.message,
            code: confirmError.code,
          });
          return;
        }
        const finalizeBody: ShopStripePaymentInput = {
          action: 'finalize',
          orderId,
          trackingId,
          paymentIntentId: paymentIntent?.id,
          funnelId: win.__AUTONNEL_FUNNEL_ID__ ?? undefined,
          pageId: win.__AUTONNEL_PAGE_ID__,
        };
        const finalize = await fetch('/api/shop/payment/stripe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalizeBody),
        });
        const finalData = (await finalize.json()) as ShopStripePaymentDto;
        if (!finalize.ok || !finalData.success) {
          const msg = finalData.error || 'Payment failed after authentication.';
          setErrors({ general: msg });
          setProcessing(false);
          emitPaymentError(msg, finalData.code);
          return;
        }
        window.dispatchEvent(new CustomEvent('autonnel:paymentComplete', {
          detail: { orderId, redirectUrl: finalData.redirectUrl },
        }));
        return;
      }

      window.dispatchEvent(new CustomEvent('autonnel:paymentComplete', {
        detail: { orderId, redirectUrl: data.redirectUrl },
      }));
    } catch (err: any) {
      console.error('[StripeCardForm] Submit error', err);
      const msg = err?.message || 'Payment failed. Please try again.';
      setErrors({ general: msg });
      setProcessing(false);
      emitPaymentError(msg, err?.code);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>{t('paypalCard.cardNumberLabel')}</label>
        <div style={{ position: 'relative' }}>
          {/* Stripe owns this node's children; keep React out of it or card.mount()
              detaches React's nodes and the next render throws removeChild. */}
          <div
            ref={cardMountRef}
            style={{
              ...iframeFieldStyle,
              minHeight: 46,
              padding: '12px 14px',
            }}
          />
          {!stripeReady && (
            <span
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
                fontSize: scaledFontSize(15),
                pointerEvents: 'none',
              }}
            >
              {t('paypalCard.loadingPayment')}
            </span>
          )}
        </div>
        {errors.card && (
          <p style={{ color: '#ef4444', fontSize: scaledFontSize(13), marginTop: 4 }}>{errors.card}</p>
        )}
      </div>

      {errors.general && (
        <div style={{
          padding: 12,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          marginBottom: 16,
        }}>
          <p style={{ color: '#dc2626', fontSize: scaledFontSize(14) }}>{errors.general}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={processing || !stripeReady}
        style={{
          width: '100%',
          padding: '16px 24px',
          background: processing || !stripeReady ? '#9ca3af' : buttonColor,
          color: 'white',
          border: 'none',
          borderRadius: 10,
          fontSize: scaledFontSize(16),
          fontWeight: 600,
          cursor: processing || !stripeReady ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          transition: 'all 0.2s',
        }}
      >
        {processing ? (
          <>
            <span style={{
              width: 20,
              height: 20,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            {t('paypalCard.processing')}
          </>
        ) : (
          <>{`🔒 ${buttonText}`}</>
        )}
      </button>
    </form>
  );
}

export default StripeCardForm;
