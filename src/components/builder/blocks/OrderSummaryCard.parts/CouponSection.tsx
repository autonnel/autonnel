import React from 'react';
import { TicketPercent } from 'lucide-react';
import { scaledFontSize } from '../../TextField';
import { PALETTE, type AppliedCoupon, type Translate } from './types';

function couponHeadline(coupon: AppliedCoupon): string | null {
  if (coupon.discountType === 'PERCENTAGE') return `${Number(coupon.discountValue)}%`;
  if (coupon.discountValue) return `$${Number(coupon.discountValue)}`;
  return null;
}

function CouponBadgeGraphic({
  coupon,
  backgroundColor,
}: {
  coupon: AppliedCoupon;
  backgroundColor: string;
}) {
  const headline = couponHeadline(coupon);
  const panelWidth = headline ? 90 : 56;

  const punchHole = (position: 'top' | 'bottom'): React.CSSProperties => ({
    position: 'absolute',
    [position]: -8,
    left: panelWidth - 8,
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: backgroundColor,
    zIndex: 2,
  });

  return (
    <>
      <div
        style={{
          background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
          color: '#fff',
          padding: headline ? '14px 20px' : '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: panelWidth,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {headline ? (
          <>
            <div
              style={{
                fontSize: scaledFontSize(24),
                fontWeight: 800,
                lineHeight: 1.1,
                textAlign: 'center',
              }}
            >
              {headline}
            </div>
            <div
              style={{
                fontSize: scaledFontSize(10),
                fontWeight: 700,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                opacity: 0.9,
                marginTop: 2,
              }}
            >
              OFF
            </div>
          </>
        ) : (
          <TicketPercent size={28} color="#fff" />
        )}
      </div>
      <div style={punchHole('top')} />
      <div style={punchHole('bottom')} />
    </>
  );
}

function AppliedCouponCard({
  coupon,
  backgroundColor,
  onRemove,
}: {
  coupon: AppliedCoupon;
  backgroundColor: string;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(22, 163, 74, 0.15)',
        position: 'relative',
      }}
    >
      <CouponBadgeGraphic coupon={coupon} backgroundColor={backgroundColor} />
      <div
        style={{
          flex: 1,
          background: '#f0fdf4',
          borderLeft: '2px dashed #bbf7d0',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: scaledFontSize(11),
              color: PALETTE.slate,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 3,
            }}
          >
            Coupon Applied
          </div>
          <div
            style={{
              fontSize: scaledFontSize(16),
              fontWeight: 800,
              color: PALETTE.greenDark,
              letterSpacing: '1px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {coupon.code}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          title="Remove coupon"
          style={{
            background: 'rgba(22, 163, 74, 0.1)',
            border: '1px solid rgba(22, 163, 74, 0.2)',
            color: PALETTE.green,
            cursor: 'pointer',
            fontSize: scaledFontSize(12),
            padding: '4px 10px',
            borderRadius: 4,
            fontWeight: 500,
            lineHeight: 1.4,
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function CouponEntry({
  code,
  setCode,
  error,
  applying,
  borderColor,
  onApply,
  t,
}: {
  code: string;
  setCode: (value: string) => void;
  error: string;
  applying: boolean;
  borderColor: string;
  onApply: () => void;
  t: Translate;
}) {
  const blocked = applying || !code.trim();

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={code}
          placeholder={t('orderSummary.couponPlaceholder')}
          onChange={event => setCode(event.target.value.toUpperCase())}
          onKeyDown={event => {
            if (event.key === 'Enter') onApply();
          }}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '8px 10px',
            borderRadius: 4,
            border: `1px solid ${error ? PALETTE.red : borderColor}`,
            fontSize: scaledFontSize(14),
            fontFamily: 'inherit',
            color: PALETTE.field,
            outline: 'none',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box',
          }}
        />
        <button
          type="button"
          onClick={onApply}
          disabled={blocked}
          style={{
            padding: '8px 16px',
            background: '#f3f4f6',
            border: `1px solid ${borderColor}`,
            borderRadius: 4,
            fontSize: scaledFontSize(14),
            fontWeight: 500,
            color: PALETTE.field,
            cursor: blocked ? 'not-allowed' : 'pointer',
            opacity: blocked ? 0.5 : 1,
          }}
        >
          {applying ? '...' : t('orderSummary.apply')}
        </button>
      </div>
      {error ? (
        <p style={{ fontSize: scaledFontSize(13), color: PALETTE.red, marginTop: 6 }}>{error}</p>
      ) : null}
    </>
  );
}

export function CouponSection({
  coupon,
  backgroundColor,
  borderColor,
  code,
  setCode,
  error,
  applying,
  onApply,
  onRemove,
  t,
}: {
  coupon: AppliedCoupon | null;
  backgroundColor: string;
  borderColor: string;
  code: string;
  setCode: (value: string) => void;
  error: string;
  applying: boolean;
  onApply: () => void;
  onRemove: () => void;
  t: Translate;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      {coupon ? (
        <AppliedCouponCard coupon={coupon} backgroundColor={backgroundColor} onRemove={onRemove} />
      ) : (
        <CouponEntry
          code={code}
          setCode={setCode}
          error={error}
          applying={applying}
          borderColor={borderColor}
          onApply={onApply}
          t={t}
        />
      )}
    </div>
  );
}
