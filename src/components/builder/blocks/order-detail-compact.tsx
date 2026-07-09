import React from 'react';
import { formatPrice } from './useProductSelection';
import { scaledFontSize } from '../TextField';
import { useTranslation } from '../LanguageContext';
import type { Order, OrderItem } from './order-detail-types';
import { PaymentMethodDetails, renderAddress } from './order-detail-states';

export interface CompactOrderTheme {
  surfaceColor: string;
  headerColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  savingColor: string;
  hairlineColor: string;
  accentColor: string;
  badgeColor: string;
  badgeTextColor: string;
}

interface CompactOrderCardProps {
  order: Order;
  theme: CompactOrderTheme;
  showShippingAddress: boolean;
  showPaymentMethod: boolean;
  totalLabel: string;
}

// Compact, fully themeable order card matching the "Funnel Checkout Suite"
// reference thank-you layout (header row · item rows · totals · shipping/payment
// two-column). Kept separate so the legacy "full" OrderDetailPanel render path
// stays byte-for-byte unchanged for OSS consumers that pass no theme props.
export function CompactOrderCard({ order, theme, showShippingAddress, showPaymentMethod, totalLabel }: CompactOrderCardProps) {
  const t = useTranslation();
  const currency = order.currency;
  const paid = order.items.filter((i) => i.price > 0);
  const freebies = order.items.filter((i) => i.price <= 0);
  const itemCount = order.items.reduce((n, i) => n + (i.quantity || 1), 0);

  const row = (extra: React.CSSProperties): React.CSSProperties => ({
    display: 'flex',
    justifyContent: 'space-between',
    ...extra,
  });

  const itemRow = (item: OrderItem) => (
    <div key={item.id} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
      <div style={{ position: 'relative', flex: 'none' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 9,
            background: theme.hairlineColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {item.image ? (
            <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: scaledFontSize(20) }}>{'\u{1F4E6}'}</span>
          )}
        </div>
        {item.quantity > 1 && (
          <div
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 20,
              height: 20,
              padding: '0 5px',
              background: theme.badgeColor,
              color: theme.badgeTextColor,
              fontSize: scaledFontSize(10),
              fontWeight: 700,
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {'×'}{item.quantity}
          </div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: theme.textColor, fontSize: scaledFontSize(13) }}>{item.name}</div>
        {item.variant && <div style={{ fontSize: scaledFontSize(11), color: theme.mutedColor }}>{item.variant}</div>}
      </div>
      <div style={{ fontWeight: 700, color: theme.textColor, fontSize: scaledFontSize(13) }}>
        {formatPrice(item.price * item.quantity, currency)}
      </div>
    </div>
  );

  return (
    <div
      className="autonnel-order-details"
      style={{ border: `1px solid ${theme.borderColor}`, borderRadius: 14, overflow: 'hidden', background: theme.surfaceColor }}
    >
      <div
        style={{
          ...row({ alignItems: 'center' }),
          background: theme.headerColor,
          padding: '12px 16px',
        }}
      >
        <div style={{ fontWeight: 800, color: theme.textColor, fontSize: scaledFontSize(14) }}>
          {t('orderDetails.order')} #{order.orderNumber}
        </div>
        <div style={{ fontSize: scaledFontSize(12), color: theme.mutedColor }}>
          {order.date} · {itemCount} {itemCount === 1 ? t('orderDetails.item') : t('orderDetails.items')}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {paid.map(itemRow)}

        {freebies.length > 0 && (
          <div style={row({ fontSize: scaledFontSize(12), color: theme.savingColor, marginBottom: 12 })}>
            <span>{'\u{1F381}'} {freebies.map((f) => f.name).join(' · ')}</span>
            <span style={{ fontWeight: 700 }}>{t('orderDetails.free').toUpperCase()}</span>
          </div>
        )}

        <div style={{ borderTop: `1px solid ${theme.borderColor}`, paddingTop: 10 }}>
          <div style={row({ fontSize: scaledFontSize(12), color: theme.mutedColor, marginBottom: 5 })}>
            <span>{t('orderDetails.subtotal')}</span>
            <span>{formatPrice(order.subtotal, currency)}</span>
          </div>
          {order.discount > 0 && (
            <div style={row({ fontSize: scaledFontSize(12), color: theme.savingColor, fontWeight: 700, marginBottom: 5 })}>
              <span>
                {t('orderDetails.discount')}
                {order.couponCode ? ` (${order.couponCode})` : ''}
              </span>
              <span>{'−'}{formatPrice(order.discount, currency)}</span>
            </div>
          )}
          <div style={row({ fontWeight: 800, color: theme.textColor, fontSize: scaledFontSize(16) })}>
            <span>{totalLabel}</span>
            <span>{formatPrice(order.total, currency)}</span>
          </div>
        </div>

        {(showShippingAddress && order.shippingAddress) || (showPaymentMethod && order.paymentMethod) ? (
          <div style={{ display: 'flex', gap: 16, borderTop: `1px solid ${theme.borderColor}`, marginTop: 12, paddingTop: 12 }}>
            {showShippingAddress && order.shippingAddress && (
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: scaledFontSize(10),
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: theme.mutedColor,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  {t('orderDetails.shippingTo')}
                </div>
                <div style={{ fontSize: scaledFontSize(13), color: theme.textColor, lineHeight: 1.45 }}>
                  {renderAddress(order.shippingAddress)}
                </div>
              </div>
            )}
            {showPaymentMethod && order.paymentMethod && (
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: scaledFontSize(10),
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: theme.mutedColor,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  {t('orderDetails.paymentDelivery')}
                </div>
                <div style={{ fontSize: scaledFontSize(13), color: theme.textColor, lineHeight: 1.45 }}>
                  <PaymentMethodDetails pm={order.paymentMethod} t={t} />
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
