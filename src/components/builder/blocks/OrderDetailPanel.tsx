import React, { useEffect, useState, type ReactNode } from 'react';
import { RichBody } from './RichBody';
import { formatPrice } from './useProductSelection';
import { scaledFontSize } from '../TextField';
import { useTranslation } from '../LanguageContext';
import type { Order, OrderItem } from './order-detail-types';
import {
  getFallbackOrder,
  ClockSvg,
  palette,
  rowBetween,
  sectionHeading,
} from './order-detail-styles';
import { OrderEmptyState, OrderLoadingState, PaymentMethodDetails, renderAddress } from './order-detail-states';
import { CompactOrderCard } from './order-detail-compact';

export interface OrderDetailPanelProps {
  title?: string;
  subtitle?: string | ReactNode;
  showOrderNumber?: boolean;
  showOrderDate?: boolean;
  showItems?: boolean;
  showShippingAddress?: boolean;
  showBillingAddress?: boolean;
  showPaymentMethod?: boolean;
  showSocialShare?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
  accentColor?: string;
  emptyStateMessage?: string;
  emptyStateStyle?: 'card' | 'inline' | 'minimal';
  // 'compact' renders only the reference order card (header row · items · totals ·
  // shipping/payment) using the theme colors below — the page supplies its own
  // hero/progress/referral. 'full' (default) is the legacy self-contained panel.
  variant?: 'full' | 'compact';
  surfaceColor?: string;
  headerColor?: string;
  textColor?: string;
  mutedColor?: string;
  savingColor?: string;
  hairlineColor?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  totalLabel?: string;
  _ssrOrder?: Order;
  // Set by the static (non-hydrated) render path: settle server-side instead of spinning forever.
  _ssrResolved?: boolean;
}

export function OrderDetailPanel({
  title = 'Order Confirmed!',
  subtitle = 'Thank you for your purchase. Your order has been received.',
  showOrderNumber = true,
  showOrderDate = true,
  showItems = true,
  showShippingAddress = true,
  showBillingAddress = false,
  showPaymentMethod = true,
  showSocialShare = false,
  backgroundColor = '#ffffff',
  borderColor = '#e5e7eb',
  borderRadius = 16,
  padding = 32,
  accentColor = '#22c55e',
  emptyStateMessage = 'Order not found. You cannot access this page directly.',
  emptyStateStyle = 'card',
  variant = 'full',
  surfaceColor,
  headerColor,
  textColor,
  mutedColor,
  savingColor,
  hairlineColor,
  badgeColor,
  badgeTextColor,
  totalLabel,
  _ssrOrder,
  _ssrResolved = false,
}: OrderDetailPanelProps) {
  const t = useTranslation();
  const [order, setOrder] = useState<Order | null>(_ssrOrder || null);
  const [loading, setLoading] = useState(!_ssrOrder && !_ssrResolved);

  useEffect(() => {
    if (_ssrOrder || _ssrResolved) return;

    const preloaded = (window as any).__AUTONNEL_ORDER__ as Order | undefined;
    if (preloaded) {
      setOrder(preloaded);
      setLoading(false);
      return;
    }

    const onOrderData = (event: Event) => {
      const payload = (event as CustomEvent).detail as Order | undefined;
      if (!payload) return;
      setOrder(payload);
      setLoading(false);
    };
    window.addEventListener('autonnel:orderData', onOrderData);
    window.dispatchEvent(new CustomEvent('autonnel:requestOrder'));

    const awaitingRemote = new URLSearchParams(window.location.search).has('orderId');
    const waitMs = awaitingRemote ? 5000 : 500;
    const timer = window.setTimeout(() => {
      if (!awaitingRemote) setOrder(getFallbackOrder());
      setLoading(false);
    }, waitMs);

    return () => {
      window.removeEventListener('autonnel:orderData', onOrderData);
      window.clearTimeout(timer);
    };
  }, [_ssrOrder, _ssrResolved]);

  const compact = variant === 'compact';
  const surfaceBg = compact ? surfaceColor ?? backgroundColor : backgroundColor;

  if (loading) {
    return (
      <OrderLoadingState
        backgroundColor={surfaceBg}
        borderRadius={borderRadius}
        padding={padding}
        accentColor={accentColor}
      />
    );
  }

  if (!order) {
    return (
      <OrderEmptyState
        text={emptyStateMessage || t('orderDetails.orderNotFound')}
        emptyStateStyle={emptyStateStyle}
        backgroundColor={surfaceBg}
        borderRadius={borderRadius}
        padding={padding}
        textColor={compact ? textColor : undefined}
      />
    );
  }

  if (compact) {
    return (
      <CompactOrderCard
        order={order}
        theme={{
          surfaceColor: surfaceColor ?? backgroundColor,
          headerColor: headerColor ?? palette.panel,
          textColor: textColor ?? palette.ink,
          mutedColor: mutedColor ?? palette.body,
          borderColor,
          savingColor: savingColor ?? palette.saving,
          hairlineColor: hairlineColor ?? palette.hairline,
          accentColor,
          badgeColor: badgeColor ?? palette.ink,
          badgeTextColor: badgeTextColor ?? palette.white,
        }}
        showShippingAddress={showShippingAddress}
        showPaymentMethod={showPaymentMethod}
        totalLabel={totalLabel ?? t('orderDetails.totalPaid')}
      />
    );
  }

  const pending = order.paymentPending;
  const currency = order.currency;

  const badgeStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: pending
      ? 'linear-gradient(135deg, #F59E0B, #D97706)'
      : `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: pending
      ? '0 4px 10px rgba(245, 158, 11, 0.3)'
      : `0 4px 10px ${accentColor}4d`,
  };

  const summaryRow = rowBetween({ marginBottom: 8, fontSize: scaledFontSize(14), color: palette.body });
  const microLabel: React.CSSProperties = {
    fontSize: scaledFontSize(11),
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: palette.muted,
    marginBottom: 6,
  };
  const detailValue: React.CSSProperties = { fontSize: scaledFontSize(14), color: palette.body, lineHeight: 1.6 };

  const header = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 24,
      }}
    >
      <div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
          <div style={badgeStyle}>
            {pending ? (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" d="M12 6v6l4 2" />
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <h2 style={{ fontSize: scaledFontSize(22), fontWeight: 700, color: palette.ink }}>
            {pending ? t('orderDetails.orderReceived') : title}
          </h2>
        </div>
        <RichBody
          value={pending ? t('orderDetails.pendingSubtitle') : subtitle}
          style={{ fontSize: scaledFontSize(14), color: palette.body, marginLeft: 52 }}
        />
      </div>
      {(showOrderNumber || showOrderDate) && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {showOrderNumber && (
            <div style={{ fontSize: scaledFontSize(14), fontWeight: 700, color: palette.ink }}>
              {t('orderDetails.order')} #{order.orderNumber}
            </div>
          )}
          {showOrderDate && (
            <div style={{ fontSize: scaledFontSize(13), color: palette.body, marginTop: 2 }}>{order.date}</div>
          )}
        </div>
      )}
    </div>
  );

  const pendingBanner = pending && (
    <div
      style={{
        padding: '16px 20px',
        background: '#FEF3C7',
        borderRadius: 10,
        border: '1px solid #F59E0B',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <ClockSvg stroke="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <p style={{ fontSize: scaledFontSize(15), fontWeight: 600, color: '#92400E', marginBottom: 4 }}>
          {t('orderDetails.paymentProcessing')}
        </p>
        <p style={{ fontSize: scaledFontSize(14), color: '#A16207', lineHeight: 1.5, margin: 0 }}>
          {order.paymentPendingMessage}
        </p>
      </div>
    </div>
  );

  const lineItem = (item: OrderItem, isLast: boolean) => (
    <div
      key={item.id}
      style={{
        display: 'flex',
        gap: 14,
        padding: '16px 0',
        borderBottom: isLast ? 'none' : `1px solid ${borderColor}`,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 10,
          background: palette.hairline,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }}
          />
        ) : (
          <span style={{ fontSize: scaledFontSize(24) }}>{'\u{1F4E6}'}</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <p style={{ fontSize: scaledFontSize(15), fontWeight: 600, color: palette.ink }}>{item.name}</p>
          <p style={{ fontSize: scaledFontSize(15), fontWeight: 700, color: palette.ink, whiteSpace: 'nowrap' }}>
            {formatPrice(item.price * item.quantity, currency)}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {item.variant && (
            <span
              style={{
                fontSize: scaledFontSize(12),
                color: palette.body,
                background: palette.chip,
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              {item.variant}
            </span>
          )}
          <span style={{ fontSize: scaledFontSize(13), color: palette.body }}>
            {t('orderDetails.qty')} {item.quantity}
          </span>
        </div>
      </div>
    </div>
  );

  const itemsContent = showItems && order.items.length > 0;
  const detailContent = Boolean(
    (showShippingAddress && order.shippingAddress)
    || (showBillingAddress && order.billingAddress)
    || (showPaymentMethod && order.paymentMethod),
  );

  const itemsColumn = itemsContent && (
    <div style={{ flex: '2 1 380px' }}>
      <h3 style={{ ...sectionHeading(16), marginBottom: 16 }}>{t('orderDetails.itemsOrdered')}</h3>
      {order.items.map((item, idx) => lineItem(item, idx === order.items.length - 1))}
    </div>
  );

  const summarySidebar = (itemsContent || detailContent) && (
    <div
      style={{
        flex: itemsContent ? '1 1 260px' : '1 1 100%',
        padding: 20,
        background: palette.panel,
        borderRadius: 12,
      }}
    >
      {itemsContent && (
        <div>
          <div style={summaryRow}>
            <span>{t('orderDetails.subtotal')}</span>
            <span>{formatPrice(order.subtotal, currency)}</span>
          </div>
          <div style={summaryRow}>
            <span>{t('orderDetails.shipping')}</span>
            <span>
              {order.shipping === 0
                ? t('orderDetails.free')
                : formatPrice(order.shipping, currency)}
            </span>
          </div>
          {order.discount > 0 && (
            <div style={rowBetween({ marginBottom: 8, fontSize: scaledFontSize(14), color: palette.saving })}>
              <span>
                {t('orderDetails.discount')}
                {order.couponCode ? ` (${order.couponCode})` : ''}
              </span>
              <span>-{formatPrice(order.discount, currency)}</span>
            </div>
          )}
          <div style={summaryRow}>
            <span>{t('orderDetails.tax')}</span>
            <span>{t('orderDetails.taxIncluded')}</span>
          </div>
          <div
            style={rowBetween({
              paddingTop: 12,
              borderTop: `1px solid ${borderColor}`,
              fontSize: scaledFontSize(16),
              fontWeight: 700,
              color: palette.ink,
            })}
          >
            <span>{t('orderDetails.total')}</span>
            <span>{formatPrice(order.total, currency)}</span>
          </div>
        </div>
      )}
      {detailContent && (
        <div style={itemsContent ? { marginTop: 20, paddingTop: 20, borderTop: `1px solid ${borderColor}` } : undefined}>
          {showShippingAddress && order.shippingAddress && (
            <div style={{ marginBottom: 16 }}>
              <div style={microLabel}>{t('orderDetails.shippingAddress')}</div>
              <div style={detailValue}>{renderAddress(order.shippingAddress)}</div>
            </div>
          )}
          {showBillingAddress && order.billingAddress && (
            <div style={{ marginBottom: 16 }}>
              <div style={microLabel}>{t('orderDetails.billingAddress')}</div>
              <div style={detailValue}>{renderAddress(order.billingAddress)}</div>
            </div>
          )}
          {showPaymentMethod && order.paymentMethod && (
            <div>
              <div style={microLabel}>{t('orderDetails.paymentMethod')}</div>
              <div style={detailValue}><PaymentMethodDetails pm={order.paymentMethod} t={t} /></div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const bodyRow = (itemsContent || detailContent) && (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 24, alignItems: 'flex-start' }}>
      {itemsColumn}
      {summarySidebar}
    </div>
  );

  const shareBlock = showSocialShare && (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20 }}>
      {['Twitter', 'Facebook', 'Instagram'].map((platform) => (
        <button
          key={platform}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: `1px solid ${borderColor}`,
            background: palette.white,
            cursor: 'pointer',
            fontSize: scaledFontSize(13),
            fontWeight: 500,
            color: palette.body,
          }}
        >
          {t('orderDetails.shareOn', { platform })}
        </button>
      ))}
    </div>
  );

  return (
    <div
      style={{ background: backgroundColor, borderRadius, padding, border: `1px solid ${borderColor}` }}
      className="autonnel-order-details"
    >
      {header}
      {pendingBanner}
      {bodyRow}
      {shareBlock}
    </div>
  );
}

export { OrderDetailPanelConfig } from './OrderDetailPanelConfig';

export default OrderDetailPanel;
