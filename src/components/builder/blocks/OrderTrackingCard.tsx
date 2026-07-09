import React, { useState } from 'react';
import { useTranslation } from '../LanguageContext';
import { t as translate, type TranslationKey } from '../translations';
import { scaledFontSize } from '../TextField';

export interface OrderItem {
  id: string;
  name: string;
  variant?: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface TrackedOrder {
  id: string;
  orderNumber: string;
  date: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'refunded' | 'partial_refund';
  items: OrderItem[];
  total: number;
  currency: string;
  shippingAddress?: {
    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  trackingNumber?: string;
  trackingUrl?: string;
  trackingCompany?: string;
  shipmentStatus?: string;
}

type OrderStatus = TrackedOrder['status'];
type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface StatusTheme {
  fg: string;
  bg: string;
  labelKey: TranslationKey;
}

const STATUS_THEME: Record<OrderStatus, StatusTheme> = {
  pending: { fg: '#d97706', bg: '#fef3c7', labelKey: 'orderCard.paymentPending' },
  paid: { fg: '#2563eb', bg: '#dbeafe', labelKey: 'orderCard.orderConfirmed' },
  shipped: { fg: '#7c3aed', bg: '#ede9fe', labelKey: 'orderCard.shipped' },
  delivered: { fg: '#16a34a', bg: '#dcfce7', labelKey: 'orderCard.delivered' },
  refunded: { fg: '#dc2626', bg: '#fee2e2', labelKey: 'orderCard.refunded' },
  partial_refund: { fg: '#ea580c', bg: '#ffedd5', labelKey: 'orderCard.partiallyRefunded' },
};

const SHIPMENT_LABEL_KEYS: Record<string, TranslationKey> = {
  label_printed: 'shipment.labelPrinted',
  label_purchased: 'shipment.labelPurchased',
  attempted_delivery: 'shipment.attemptedDelivery',
  ready_for_pickup: 'shipment.readyForPickup',
  confirmed: 'shipment.confirmed',
  in_transit: 'shipment.inTransit',
  out_for_delivery: 'shipment.outForDelivery',
  delivered: 'shipment.delivered',
  failure: 'shipment.failure',
  pending: 'shipment.pending',
  open: 'shipment.open',
  success: 'shipment.success',
};

export const statusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string }> = (
  Object.keys(STATUS_THEME) as OrderStatus[]
).reduce((acc, key) => {
  const theme = STATUS_THEME[key];
  acc[key] = { label: translate('en', theme.labelKey), color: theme.fg, bgColor: theme.bg };
  return acc;
}, {} as Record<OrderStatus, { label: string; color: string; bgColor: string }>);

function titleCase(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolveShipmentLabel(status: string, t: Translate): string {
  const key = SHIPMENT_LABEL_KEYS[status];
  return key ? t(key) : titleCase(status);
}

interface OrderCardProps {
  order: TrackedOrder;
  showOrderStatus: boolean;
  showOrderItems: boolean;
  showShippingAddress: boolean;
  showPaymentInfo: boolean;
  borderColor: string;
  accentColor: string;
  formatCurrency: (amount: number, currency: string) => string;
}

function DisclosureCaret({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9ca3af"
      strokeWidth="2"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ItemThumb({ name, image }: { name: string; image?: string }) {
  const frame: React.CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: 8,
    flexShrink: 0,
    background: '#e5e7eb',
  };
  if (image) {
    return <img src={image} alt={name} style={{ ...frame, objectFit: 'cover' }} />;
  }
  const monogram = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      data-autonnel-puck="order-item-thumb"
      aria-hidden="true"
      style={{
        ...frame,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9ca3af',
        fontWeight: 600,
        fontSize: scaledFontSize(18),
      }}
    >
      {monogram}
    </span>
  );
}

function TrackingPanel({
  order,
  accentColor,
  t,
}: {
  order: TrackedOrder;
  accentColor: string;
  t: Translate;
}) {
  return (
    <section
      data-autonnel-puck="order-card-tracking"
      style={{
        padding: 16,
        background: `${accentColor}10`,
        border: `1px solid ${accentColor}30`,
        borderRadius: 10,
        marginBottom: 20,
      }}
    >
      {order.shipmentStatus && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            paddingBottom: 12,
            borderBottom: `1px solid ${accentColor}20`,
          }}
        >
          <span
            aria-hidden="true"
            style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor, flexShrink: 0 }}
          />
          <span style={{ fontSize: scaledFontSize(14), fontWeight: 600, color: accentColor }}>
            {resolveShipmentLabel(order.shipmentStatus, t)}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          {order.trackingCompany && (
            <p style={{ fontSize: scaledFontSize(12), color: '#6b7280', marginBottom: 2 }}>
              {order.trackingCompany}
            </p>
          )}
          <p
            style={{
              fontSize: scaledFontSize(14),
              fontWeight: 600,
              color: '#111827',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              letterSpacing: '0.02em',
            }}
          >
            {order.trackingNumber}
          </p>
        </div>
        {order.trackingUrl && (
          <a
            href={order.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '8px 16px',
              background: accentColor,
              color: 'white',
              borderRadius: 8,
              fontSize: scaledFontSize(13),
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            {t('orderCard.trackPackage')}
          </a>
        )}
      </div>
    </section>
  );
}

export function OrderCard(props: OrderCardProps) {
  const {
    order,
    showOrderStatus,
    showOrderItems,
    showShippingAddress,
    showPaymentInfo,
    borderColor,
    accentColor,
    formatCurrency,
  } = props;

  const t = useTranslation();
  const [open, setOpen] = useState(false);

  const theme = STATUS_THEME[order.status];
  const lineItems = showOrderItems ? order.items : [];
  const address = showShippingAddress ? order.shippingAddress : undefined;
  const money = (amount: number) => formatCurrency(amount, order.currency);

  return (
    <div
      data-autonnel-puck="order-card"
      style={{ border: `1px solid ${borderColor}`, borderRadius: 12, overflow: 'hidden' }}
    >
      <button
        type="button"
        data-autonnel-puck="order-card-header"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: 20,
          background: '#f9fafb',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <span style={{ display: 'block' }}>
          <span
            style={{
              display: 'block',
              fontSize: scaledFontSize(14),
              fontWeight: 600,
              color: '#111827',
              marginBottom: 4,
            }}
          >
            {order.orderNumber}
          </span>
          <span style={{ display: 'block', fontSize: scaledFontSize(13), color: '#6b7280' }}>
            {order.date}
          </span>
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {showOrderStatus && (
            <span
              style={{
                padding: '6px 12px',
                background: theme.bg,
                color: theme.fg,
                borderRadius: 20,
                fontSize: scaledFontSize(13),
                fontWeight: 500,
              }}
            >
              {t(theme.labelKey)}
            </span>
          )}
          <span style={{ fontSize: scaledFontSize(16), fontWeight: 600, color: '#111827' }}>
            {money(order.total)}
          </span>
          <DisclosureCaret open={open} />
        </span>
      </button>

      {open && (
        <div style={{ padding: 20, borderTop: `1px solid ${borderColor}` }}>
          {order.trackingNumber && <TrackingPanel order={order} accentColor={accentColor} t={t} />}

          {lineItems.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4
                style={{
                  fontSize: scaledFontSize(14),
                  fontWeight: 600,
                  marginBottom: 12,
                  color: '#111827',
                }}
              >
                {t('orderCard.items')}
              </h4>
              {lineItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '12px 0',
                    borderBottom: `1px solid ${borderColor}`,
                    alignItems: 'center',
                  }}
                >
                  <ItemThumb name={item.name} image={item.image} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: scaledFontSize(14), fontWeight: 500, color: '#111827' }}>
                      {item.name}
                    </p>
                    {item.variant && (
                      <p style={{ fontSize: scaledFontSize(13), color: '#6b7280' }}>{item.variant}</p>
                    )}
                    <p style={{ fontSize: scaledFontSize(13), color: '#6b7280' }}>
                      {`${t('orderCard.qty')} ${item.quantity}`}
                    </p>
                  </div>
                  <p style={{ fontSize: scaledFontSize(14), fontWeight: 600, color: '#111827' }}>
                    {money(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {address && (
            <div style={{ padding: 16, background: '#f9fafb', borderRadius: 10, marginBottom: 12 }}>
              <h4
                style={{
                  fontSize: scaledFontSize(14),
                  fontWeight: 600,
                  marginBottom: 8,
                  color: '#111827',
                }}
              >
                {t('orderCard.shippingAddress')}
              </h4>
              <div style={{ fontSize: scaledFontSize(14), color: '#6b7280', lineHeight: 1.6 }}>
                <div>{`${address.firstName} ${address.lastName}`}</div>
                <div>{address.address1}</div>
                <div>{`${address.city}, ${address.state} ${address.postalCode}`}</div>
                <div>{address.country}</div>
              </div>
            </div>
          )}

          {showPaymentInfo && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '16px 0',
                borderTop: `1px solid ${borderColor}`,
              }}
            >
              <span style={{ fontSize: scaledFontSize(15), fontWeight: 600, color: '#111827' }}>
                {t('orderCard.totalPaid')}
              </span>
              <span style={{ fontSize: scaledFontSize(15), fontWeight: 700, color: '#111827' }}>
                {money(order.total)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
