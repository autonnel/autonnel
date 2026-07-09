import { scaledFontSize } from '../TextField';
import { useTranslation } from '../LanguageContext';
import type { Address, Order } from './order-detail-types';
import { palette } from './order-detail-styles';

type Translate = ReturnType<typeof useTranslation>;

export function PaymentMethodDetails({ pm, t }: { pm: NonNullable<Order['paymentMethod']>; t: Translate }) {
  if (pm.type === 'card') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {pm.brand && <span>{pm.brand}</span>}
        {pm.last4 ? (
          <span>{'••••'} {pm.last4}</span>
        ) : (
          <span>{t('orderDetails.creditCard')}</span>
        )}
      </div>
    );
  }
  if (pm.type === 'paypal') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#003087">
          <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z" />
        </svg>
        <span>PayPal</span>
        {pm.email && <span>({pm.email})</span>}
      </div>
    );
  }
  return <span>{pm.type}</span>;
}

export function renderAddress(addr?: Address) {
  if (!addr) return null;
  return (
    <>
      <div>{addr.firstName} {addr.lastName}</div>
      <div>{addr.address1}</div>
      {addr.address2 && <div>{addr.address2}</div>}
      <div>{addr.city}, {addr.state} {addr.postalCode}</div>
      <div>{addr.country}</div>
    </>
  );
}

export function OrderLoadingState({
  backgroundColor,
  borderRadius,
  padding,
  accentColor,
}: {
  backgroundColor: string;
  borderRadius: number;
  padding: number;
  accentColor: string;
}) {
  return (
    <div style={{ background: backgroundColor, borderRadius, padding, textAlign: 'center' }}>
      <div
        style={{
          width: 40,
          height: 40,
          border: `3px solid ${palette.hairline}`,
          borderTopColor: accentColor,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '40px auto',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function OrderEmptyState({
  text,
  emptyStateStyle,
  backgroundColor,
  borderRadius,
  padding,
  textColor,
}: {
  text: string;
  emptyStateStyle: 'card' | 'inline' | 'minimal';
  backgroundColor: string;
  borderRadius: number;
  padding: number;
  textColor?: string;
}) {
  const bodyColor = textColor ?? palette.body;
  if (emptyStateStyle === 'inline') {
    return (
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <p style={{ color: bodyColor, margin: 0, fontSize: scaledFontSize(15) }}>{text}</p>
      </div>
    );
  }
  if (emptyStateStyle === 'minimal') {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <p style={{ color: textColor ?? palette.muted, margin: 0, fontSize: scaledFontSize(13) }}>{text}</p>
      </div>
    );
  }
  return (
    <div style={{ background: backgroundColor, borderRadius, padding, textAlign: 'center' }}>
      <p style={{ color: bodyColor, margin: 0, fontSize: scaledFontSize(15) }}>{text}</p>
    </div>
  );
}
