import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

import { OrderDetailPanel } from './OrderDetailPanel';
import { TotalsBlock } from './OrderSummaryCard.parts/Totals';
import type { Order } from './order-detail-types';

// A real, fully-populated paid order (mirrors the "Funnel Checkout Suite" reference
// thank-you), driven through the SSR-resolved path so no demo fallback can apply.
const REAL_ORDER: Order = {
  id: 'ord_real_1',
  orderNumber: 'LM-48213',
  date: 'Jun 18, 2026',
  status: 'paid',
  items: [
    { id: 'i1', name: 'Radiance Renewal Serum', variant: '3-bottle routine · 30ml each', price: 117, quantity: 3, image: '' },
    { id: 'i2', name: 'Jade roller', price: 0, quantity: 1 },
  ],
  subtotal: 294,
  shipping: 0,
  tax: 0,
  discount: 177,
  total: 117,
  currency: 'USD',
  couponCode: 'GLOW10',
  shippingAddress: {
    firstName: 'Jordan', lastName: 'Mercer', address1: '214 Magnolia Ave',
    city: 'Austin', state: 'TX', postalCode: '78704', country: 'US',
  },
  paymentMethod: { type: 'card', brand: 'Visa', last4: '4242' },
};

describe('OrderDetailPanel variant="compact" — real order, reference order card', () => {
  it('renders the compact reference card from a real order (image #2 regression)', () => {
    const { container } = render(
      <OrderDetailPanel
        variant="compact"
        _ssrOrder={REAL_ORDER}
        _ssrResolved
        totalLabel="Total paid"
        surfaceColor="#ffffff"
        headerColor="#f6efe6"
        textColor="#26211c"
        mutedColor="#6f685e"
        savingColor="#9a5436"
        borderColor="#eaddcd"
        badgeColor="#26211c"
        badgeTextColor="#ffffff"
      />,
    );
    const text = container.textContent || '';

    // Real order data is shown
    expect(text).toContain('Order #LM-48213');
    expect(text).toContain('Radiance Renewal Serum');
    expect(text).toContain('$117.00');
    expect(text).toContain('177.00'); // discount line
    expect(text).toContain('GLOW10');
    expect(text).toContain('Total paid');
    expect(text).toContain('Shipping to');
    expect(text).toContain('Jordan');
    expect(text).toContain('Visa');
    // $0 item collapses into the FREE line
    expect(text).toContain('Jade roller');

    // The generic full-panel "Order Confirmed! / DEMO-0000 / What happens next" is GONE
    expect(text).not.toContain('Order Confirmed!');
    expect(text).not.toContain('DEMO-0000');
    expect(text).not.toContain('Sample Product');
    expect(text).not.toContain('What happens next');
  });

  it('applies the theme text color so the card is legible on a dark (Volt) surface (image #3 family)', () => {
    render(
      <OrderDetailPanel
        variant="compact"
        _ssrOrder={REAL_ORDER}
        _ssrResolved
        totalLabel="Total paid"
        surfaceColor="transparent"
        headerColor="rgba(255,255,255,0.05)"
        textColor="rgb(234, 236, 239)"
        mutedColor="rgb(138, 146, 158)"
        savingColor="rgb(200, 255, 61)"
        borderColor="rgba(255,255,255,0.10)"
        badgeColor="rgb(200, 255, 61)"
        badgeTextColor="rgb(11, 13, 16)"
      />,
    );
    // The total row carries the theme text color on its container row.
    const totalLabel = screen.getByText('Total paid');
    expect(totalLabel.parentElement?.style.color).toBe('rgb(234, 236, 239)');
  });
});

describe('OrderSummaryCard totals — dark theming (image #3: invisible Total fix)', () => {
  const t = ((key: string) => key) as any;
  const products = [
    { productId: 'p1', variantId: 'v1', quantity: 1, price: 239, name: 'VOLT Recover Pro', productName: 'VOLT Recover Pro' },
  ];

  it('renders the Total value in the themed (light) color instead of the hardcoded dark ink', () => {
    render(
      <TotalsBlock
        products={products}
        subtotal={498}
        discount={259}
        total={239}
        money={{
          currency: 'USD',
          borderColor: 'rgba(255,255,255,0.10)',
          textColor: 'rgb(234, 236, 239)',
          mutedColor: 'rgb(138, 146, 158)',
          successColor: 'rgb(200, 255, 61)',
        }}
        t={t}
      />,
    );
    // The strong Total value uses money.textColor (light), not PALETTE.ink (#111827)
    const totalValue = screen.getByText('$239.00');
    expect(totalValue.style.color).toBe('rgb(234, 236, 239)');
  });
});
