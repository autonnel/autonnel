import React from 'react';
import { scaledFontSize } from '../TextField';
import type { Order } from './order-detail-types';

// Demo order shown when the panel is previewed without a real order in context
// (e.g. editing the block directly in the builder). Date is computed per-call so
// it never freezes at the module's load time.
export function getFallbackOrder(): Order {
  return {
    id: 'demo-order',
    orderNumber: 'DEMO-0000',
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    status: 'confirmed',
    items: [{ id: 'demo-item-1', name: 'Sample Product', variant: 'Default', price: 29, quantity: 1 }],
    subtotal: 29,
    shipping: 0,
    tax: 0,
    discount: 0,
    total: 29,
    currency: 'USD',
  };
}

export const palette = {
  ink: '#111827',
  body: '#6b7280',
  muted: '#9ca3af',
  panel: '#f9fafb',
  chip: '#f3f4f6',
  hairline: '#e5e7eb',
  saving: '#16a34a',
  white: 'white',
};

export const ClockSvg = ({ stroke, ...rest }: { stroke: string } & React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth="2" {...rest}>
    <circle cx="12" cy="12" r="10" />
    <path strokeLinecap="round" d="M12 6v6l4 2" />
  </svg>
);

export const rowBetween = (extra: React.CSSProperties): React.CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  ...extra,
});

export const sectionHeading = (size: number): React.CSSProperties => ({
  fontSize: scaledFontSize(size),
  fontWeight: 600,
  color: palette.ink,
});
