import React, { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { TicketCheck } from 'lucide-react';
import { useTranslation } from '../LanguageContext';
import { scaledFontSize } from '../TextField';
import { apiCall } from '@/lib/api/client';

export interface CouponFieldProps {
  placeholder?: string;
  buttonText?: string | ReactNode;
  backgroundColor?: string;
  borderColor?: string;
  inputBackground?: string;
  inputTextColor?: string;
  buttonBackground?: string;
  buttonTextColor?: string;
}

type AppliedCoupon = {
  code: string;
  discount: number;
  couponId?: string;
  discountType?: string;
  discountValue?: number;
};

const COUPON_EVENTS = {
  applied: 'autonnel:couponApplied',
  removed: 'autonnel:couponRemoved',
} as const;

function couponFromDetail(detail: any): AppliedCoupon | null {
  if (!detail?.code) return null;
  return {
    code: detail.code,
    discount: detail.discount,
    couponId: detail.couponId,
    discountType: detail.discountType,
    discountValue: detail.discountValue,
  };
}

function demoCoupon(code: string): AppliedCoupon | null {
  return code.toLowerCase() === 'save10'
    ? { code, discount: 0, couponId: 'demo', discountType: 'PERCENTAGE', discountValue: 10 }
    : null;
}

function currentSubtotal(): number {
  return (window as any).__CHECKOUT_STATE__?.total || 0;
}

function discountBadge(coupon: AppliedCoupon | null) {
  if (!coupon) return null;
  if (coupon.discountType === 'PERCENTAGE') return `${Number(coupon.discountValue)}%`;
  return coupon.discountValue ? `$${Number(coupon.discountValue)}` : null;
}

function publishAppliedCoupon(coupon: AppliedCoupon) {
  window.dispatchEvent(new CustomEvent(COUPON_EVENTS.applied, { detail: coupon }));
}

function publishRemovedCoupon() {
  window.dispatchEvent(new CustomEvent(COUPON_EVENTS.removed));
}

function useCouponController(invalidMessage: string, failureMessage: string) {
  const [code, setCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);

  const resetCoupon = () => {
    setAppliedCoupon(null);
    setError('');
    setCode('');
  };

  useEffect(() => {
    const handleRemoved = () => resetCoupon();
    const handleApplied = (event: Event) => {
      const coupon = couponFromDetail((event as CustomEvent).detail);
      if (!coupon) return;
      setAppliedCoupon(coupon);
      setCode('');
      setError('');
    };

    window.addEventListener(COUPON_EVENTS.removed, handleRemoved);
    window.addEventListener(COUPON_EVENTS.applied, handleApplied);
    return () => {
      window.removeEventListener(COUPON_EVENTS.removed, handleRemoved);
      window.removeEventListener(COUPON_EVENTS.applied, handleApplied);
    };
  }, []);

  const applyCoupon = async (override?: string) => {
    const couponCode = override || code.trim();
    if (!couponCode) return;

    setApplying(true);
    setError('');

    try {
      if (!(window as any).__AUTONNEL_TENANT_ID__) {
        const demo = demoCoupon(couponCode);
        if (!demo) {
          setError(invalidMessage);
          return;
        }
        setAppliedCoupon(demo);
        setCode('');
        publishAppliedCoupon(demo);
        return;
      }

      const data = await apiCall('GET /api/shop/coupon', null, {
        query: { code: couponCode, subtotal: currentSubtotal() },
      });

      if (!data.valid) {
        setError(data.error || invalidMessage);
        return;
      }

      const applied = {
        code: data.code || couponCode,
        discount: data.discount ?? 0,
        couponId: data.couponId,
        discountType: data.discountType,
        discountValue: data.discountValue,
      };
      setAppliedCoupon(applied);
      setCode('');
      publishAppliedCoupon(applied);
    } catch {
      setError(failureMessage);
    } finally {
      setApplying(false);
    }
  };

  const removeCoupon = () => {
    resetCoupon();
    publishRemovedCoupon();
  };

  return {
    code,
    setCode,
    error,
    applying,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
  };
}

function couponShellStyle(backgroundColor: string): React.CSSProperties {
  return { background: backgroundColor, padding: '12px 0' };
}

function panelNotchStyle(backgroundColor: string, discountText: string | null, edge: 'top' | 'bottom'): React.CSSProperties {
  return {
    position: 'absolute',
    [edge]: -8,
    left: discountText ? 82 : 48,
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: backgroundColor,
    zIndex: 2,
  };
}

function DiscountPanel({ discountText }: { discountText: string | null }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
      color: '#fff',
      padding: discountText ? '14px 20px' : '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: discountText ? 90 : 56,
      position: 'relative',
      flexShrink: 0,
    }}>
      {discountText ? (
        <>
          <div style={{ fontSize: scaledFontSize(24), fontWeight: 800, lineHeight: 1.1, textAlign: 'center' }}>
            {discountText}
          </div>
          <div style={{ fontSize: scaledFontSize(10), fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.9, marginTop: 2 }}>
            OFF
          </div>
        </>
      ) : (
        <TicketCheck width={28} height={28} strokeWidth={2} />
      )}
    </div>
  );
}

function AppliedCouponView({
  coupon,
  discountText,
  backgroundColor,
  onRemove,
}: {
  coupon: AppliedCoupon;
  discountText: string | null;
  backgroundColor: string;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: 'flex', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(22, 163, 74, 0.15)', position: 'relative' }}>
      <DiscountPanel discountText={discountText} />
      <div style={panelNotchStyle(backgroundColor, discountText, 'top')} />
      <div style={panelNotchStyle(backgroundColor, discountText, 'bottom')} />

      <div style={{ flex: 1, background: '#f0fdf4', borderLeft: '2px dashed #bbf7d0', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: scaledFontSize(11), color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>
            Coupon Applied
          </div>
          <div style={{ fontSize: scaledFontSize(16), fontWeight: 800, color: '#15803d', letterSpacing: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {coupon.code}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          style={{ background: 'rgba(22, 163, 74, 0.1)', border: '1px solid rgba(22, 163, 74, 0.2)', color: '#16a34a', cursor: 'pointer', fontSize: scaledFontSize(12), padding: '4px 10px', borderRadius: 4, fontWeight: 500, lineHeight: 1.4, flexShrink: 0, transition: 'background 0.2s' }}
          title="Remove coupon"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function CouponEntryForm({
  code,
  error,
  applying,
  placeholder,
  buttonText,
  borderColor,
  inputBackground,
  inputTextColor,
  buttonBackground,
  buttonTextColor,
  onCodeChange,
  onApply,
}: {
  code: string;
  error: string;
  applying: boolean;
  placeholder: string;
  buttonText: string | ReactNode;
  borderColor: string;
  inputBackground: string;
  inputTextColor: string;
  buttonBackground: string;
  buttonTextColor: string;
  onCodeChange: (value: string) => void;
  onApply: () => void;
}) {
  const disabled = applying || !code.trim();

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={code}
          onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
          placeholder={placeholder}
          onKeyDown={(event) => event.key === 'Enter' && onApply()}
          style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 4, border: `1px solid ${error ? '#ef4444' : borderColor}`, fontSize: scaledFontSize(14), fontFamily: 'inherit', color: inputTextColor, background: inputBackground, outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
        />
        <button
          type="button"
          onClick={onApply}
          disabled={disabled}
          style={{ padding: '8px 16px', background: buttonBackground, border: `1px solid ${borderColor}`, borderRadius: 4, fontSize: scaledFontSize(14), fontWeight: 500, color: buttonTextColor, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
        >
          {applying ? '...' : buttonText}
        </button>
      </div>
      {error && <p style={{ fontSize: scaledFontSize(13), color: '#ef4444', marginTop: 6 }}>{error}</p>}
    </>
  );
}

export function CouponField({
  placeholder,
  buttonText,
  backgroundColor = '#ffffff',
  borderColor = '#e5e7eb',
  inputBackground = '#ffffff',
  inputTextColor = '#333333',
  buttonBackground = '#f3f4f6',
  buttonTextColor = '#333333',
}: CouponFieldProps & { id?: string; puck?: any }) {
  const t = useTranslation();
  const coupon = useCouponController(
    t('orderSummary.invalidCoupon'),
    t('orderSummary.couponFailed'),
  );

  useEffect(() => {
    const urlCoupon = new URLSearchParams(window.location.search).get('coupon');
    if (urlCoupon && !coupon.appliedCoupon) {
      coupon.applyCoupon(urlCoupon);
    }
  }, []);

  const discountText = discountBadge(coupon.appliedCoupon);

  return (
    <div className="autonnel-coupon-input" style={couponShellStyle(backgroundColor)}>
      {coupon.appliedCoupon ? (
        <AppliedCouponView
          coupon={coupon.appliedCoupon}
          discountText={discountText}
          backgroundColor={backgroundColor}
          onRemove={coupon.removeCoupon}
        />
      ) : (
        <CouponEntryForm
          code={coupon.code}
          error={coupon.error}
          applying={coupon.applying}
          placeholder={placeholder || t('orderSummary.couponPlaceholder')}
          buttonText={buttonText || t('orderSummary.apply')}
          borderColor={borderColor}
          inputBackground={inputBackground}
          inputTextColor={inputTextColor}
          buttonBackground={buttonBackground}
          buttonTextColor={buttonTextColor}
          onCodeChange={coupon.setCode}
          onApply={() => coupon.applyCoupon()}
        />
      )}
    </div>
  );
}

export const CouponFieldConfig = {
  label: 'Coupon Input',
  fields: {
    placeholder: { type: 'text' as const, label: 'Placeholder Text' },
    buttonText: { type: 'text' as const, label: 'Button Text', contentEditable: true },
    backgroundColor: { type: 'text' as const, label: 'Background Color' },
    borderColor: { type: 'text' as const, label: 'Border Color' },
    inputBackground: { type: 'text' as const, label: 'Input Background' },
    inputTextColor: { type: 'text' as const, label: 'Input Text Color' },
    buttonBackground: { type: 'text' as const, label: 'Button Background' },
    buttonTextColor: { type: 'text' as const, label: 'Button Text Color' },
  },
  defaultProps: {
    placeholder: '',
    buttonText: '',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    inputBackground: '#ffffff',
    inputTextColor: '#333333',
    buttonBackground: '#f3f4f6',
    buttonTextColor: '#333333',
  },
  render: CouponField,
};

export default CouponField;
