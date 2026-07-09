import React, { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Inbox, Search } from 'lucide-react';
import { RichBody } from './RichBody';
import { OrderCard } from './OrderTrackingCard';
import type { TrackedOrder } from './OrderTrackingCard';
import { useTranslation } from '../LanguageContext';
import { getTextContent, getTextStyle, hasText, scaledFontSize, type TextFieldValue } from '../TextField';
import type { OrderTrackingPanelProps } from './OrderTrackingPanel';

export function currencyFormatter() {
  return (amount: number, currency: string) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);
}

export function containerStyle(props: Required<Pick<OrderTrackingPanelProps, 'backgroundColor' | 'borderColor' | 'borderRadius' | 'padding'>>): React.CSSProperties {
  return {
    background: props.backgroundColor,
    borderRadius: props.borderRadius,
    padding: props.padding,
    border: `1px solid ${props.borderColor}`,
    maxWidth: 800,
    margin: '0 auto',
  };
}

function HeaderIcon({ accentColor }: { accentColor: string }) {
  return (
    <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${accentColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
      <Search width={32} height={32} color={accentColor} strokeWidth={2} />
    </div>
  );
}

export function TrackingHeader({
  title,
  subtitle,
  accentColor,
}: {
  title: string | TextFieldValue;
  subtitle: string | ReactNode;
  accentColor: string;
}) {
  const titleText = getTextContent(title);
  const titleStyle = getTextStyle(title, { color: '#111827', fontSize: 24 });

  return (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <HeaderIcon accentColor={accentColor} />
      {hasText(title) && <h2 style={{ ...titleStyle, fontWeight: 700, marginBottom: 8 }}>{titleText}</h2>}
      <RichBody value={subtitle} style={{ fontSize: scaledFontSize(15), color: '#6b7280', maxWidth: 500, margin: '0 auto' }} />
    </div>
  );
}

function SubmitButton({
  loading,
  color,
  text,
}: {
  loading: boolean;
  color: string;
  text: string | TextFieldValue;
}) {
  const t = useTranslation();
  const content = getTextContent(text);
  const textStyle = getTextStyle(text, { color: '#ffffff', fontSize: 15 });

  return (
    <button
      type="submit"
      disabled={loading}
      style={{ padding: '14px 28px', background: loading ? '#9ca3af' : color, color: textStyle.color || 'white', border: 'none', borderRadius: 10, fontSize: textStyle.fontSize || 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'transform 0.1s, box-shadow 0.2s' }}
      onMouseDown={(event) => {
        if (!loading) (event.target as HTMLElement).style.transform = 'scale(0.98)';
      }}
      onMouseUp={(event) => {
        (event.target as HTMLElement).style.transform = 'scale(1)';
      }}
    >
      {loading ? (
        <>
          <span style={{ width: 16, height: 16, border: '2px solid transparent', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          {t('orderTracking.searching')}
        </>
      ) : content}
    </button>
  );
}

function TrackingInput({
  type,
  value,
  placeholder,
  borderColor,
  accentColor,
  onChange,
}: {
  type: 'email' | 'text';
  value: string;
  placeholder: string;
  borderColor: string;
  accentColor: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      required
      style={{ flex: 1, minWidth: 200, padding: '14px 16px', border: `1px solid ${borderColor}`, borderRadius: 10, fontSize: scaledFontSize(15), outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }}
      onFocus={(event) => {
        event.target.style.borderColor = accentColor;
        event.target.style.boxShadow = `0 0 0 3px ${accentColor}20`;
      }}
      onBlur={(event) => {
        event.target.style.borderColor = borderColor;
        event.target.style.boxShadow = 'none';
      }}
    />
  );
}

export function SearchForm({
  email,
  orderNumber,
  loading,
  borderColor,
  accentColor,
  emailLabel,
  emailPlaceholder,
  orderNumberLabel,
  orderNumberPlaceholder,
  submitButtonText,
  submitButtonColor,
  onEmailChange,
  onOrderNumberChange,
  onSubmit,
}: {
  email: string;
  orderNumber: string;
  loading: boolean;
  borderColor: string;
  accentColor: string;
  emailLabel: string;
  emailPlaceholder: string;
  orderNumberLabel: string;
  orderNumberPlaceholder: string;
  submitButtonText: string | TextFieldValue;
  submitButtonColor: string;
  onEmailChange: (email: string) => void;
  onOrderNumberChange: (orderNumber: string) => void;
  onSubmit: () => void;
}) {
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: scaledFontSize(14), fontWeight: 500, color: '#374151', marginBottom: 8 };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      style={{ marginBottom: 32 }}
    >
      <label style={labelStyle}>{emailLabel}</label>
      <div style={{ marginBottom: 16 }}>
        <TrackingInput type="email" value={email} placeholder={emailPlaceholder} borderColor={borderColor} accentColor={accentColor} onChange={onEmailChange} />
      </div>

      <label style={labelStyle}>{orderNumberLabel}</label>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <TrackingInput type="text" value={orderNumber} placeholder={orderNumberPlaceholder} borderColor={borderColor} accentColor={accentColor} onChange={onOrderNumberChange} />
        <SubmitButton loading={loading} color={submitButtonColor} text={submitButtonText} />
      </div>
    </form>
  );
}

export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div style={{ padding: 16, background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 10, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: scaledFontSize(20) }}>!</span>
      <p style={{ fontSize: scaledFontSize(14), color: '#dc2626', margin: 0 }}>{error}</p>
    </div>
  );
}

function EmptyOrders({
  message,
  supportEmail,
  accentColor,
}: {
  message: string | ReactNode;
  supportEmail: string;
  accentColor: string;
}) {
  const t = useTranslation();
  return (
    <div style={{ padding: 40, textAlign: 'center', background: '#f9fafb', borderRadius: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Inbox width={28} height={28} color="#9ca3af" strokeWidth={2} />
      </div>
      <RichBody value={message} style={{ fontSize: scaledFontSize(15), color: '#6b7280', marginBottom: 16 }} />
      <a href={`mailto:${supportEmail}`} style={{ color: accentColor, textDecoration: 'none', fontWeight: 500, fontSize: scaledFontSize(14) }}>
        {t('orderTracking.contactSupport')}
      </a>
    </div>
  );
}

function OrdersList({
  orders,
  borderColor,
  accentColor,
  visibility,
}: {
  orders: TrackedOrder[];
  borderColor: string;
  accentColor: string;
  visibility: Pick<OrderTrackingPanelProps, 'showOrderStatus' | 'showOrderItems' | 'showShippingAddress' | 'showPaymentInfo'>;
}) {
  const t = useTranslation();
  const formatCurrency = useMemo(currencyFormatter, []);

  return (
    <div>
      <h3 style={{ fontSize: scaledFontSize(16), fontWeight: 600, color: '#111827', marginBottom: 16 }}>
        {t('orderTracking.foundOrders', { count: orders.length })}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            showOrderStatus={visibility.showOrderStatus ?? true}
            showOrderItems={visibility.showOrderItems ?? true}
            showShippingAddress={visibility.showShippingAddress ?? true}
            showPaymentInfo={visibility.showPaymentInfo ?? true}
            borderColor={borderColor}
            accentColor={accentColor}
            formatCurrency={formatCurrency}
          />
        ))}
      </div>
    </div>
  );
}

export function SearchResults({
  searched,
  orders,
  emptyMessage,
  supportEmail,
  borderColor,
  accentColor,
  visibility,
}: {
  searched: boolean;
  orders: TrackedOrder[] | null;
  emptyMessage: string | ReactNode;
  supportEmail: string;
  borderColor: string;
  accentColor: string;
  visibility: Pick<OrderTrackingPanelProps, 'showOrderStatus' | 'showOrderItems' | 'showShippingAddress' | 'showPaymentInfo'>;
}) {
  if (!searched || orders === null) return null;
  if (orders.length === 0) {
    return <EmptyOrders message={emptyMessage} supportEmail={supportEmail} accentColor={accentColor} />;
  }
  return <OrdersList orders={orders} borderColor={borderColor} accentColor={accentColor} visibility={visibility} />;
}
